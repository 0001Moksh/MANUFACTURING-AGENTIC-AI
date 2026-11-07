param([switch]$Install)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$taskName = 'IIIOT-Veda-Startup'
$logDir = Join-Path $root 'logs\windows-startup'

function Write-StartupLog([string]$message) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    Add-Content -LiteralPath (Join-Path $logDir 'startup.log') -Value "$(Get-Date -Format o) $message"
}

function Test-LocalPort([int]$port) {
    $client = [Net.Sockets.TcpClient]::new()
    try {
        $result = $client.BeginConnect('127.0.0.1', $port, $null, $null)
        return ($result.AsyncWaitHandle.WaitOne(500) -and $client.Connected)
    } catch { return $false }
    finally { $client.Close() }
}

function Start-Component([string]$name, [string]$executable, [string[]]$arguments, [string]$workingDir, [int]$port) {
    if (Test-LocalPort $port) { return }
    if (-not (Test-Path -LiteralPath $executable)) {
        Write-StartupLog "$name missing executable: $executable"
        return
    }
    if (-not (Test-Path -LiteralPath $workingDir)) {
        Write-StartupLog "$name missing working directory: $workingDir"
        return
    }
    try {
        $process = Start-Process -FilePath $executable -ArgumentList $arguments -WorkingDirectory $workingDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir "$name.out.log") -RedirectStandardError (Join-Path $logDir "$name.err.log")
        Write-StartupLog "Started $name (PID $($process.Id)); waiting for port $port."
    } catch { Write-StartupLog "Could not start $name`: $($_.Exception.Message)" }
}

function Set-OptionalInput([string]$plugin) {
    $path = Join-Path $env:ProgramFiles "IIIOT-Veda\config\mai-$plugin.conf"
    if (-not (Test-Path -LiteralPath $path)) { return }
    $original = Get-Content -LiteralPath $path -Raw
    $header = "[[inputs.$plugin]]"
    if (-not $original.Contains($header)) { return }
    $updated = [regex]::Replace($original, '(?m)^\s*startup_error_behavior\s*=\s*"[^"]*"\s*\r?\n', '')
    $updated = $updated.Replace($header, "$header`r`n  startup_error_behavior = `"ignore`"")
    if ($updated -ne $original) {
        Copy-Item -LiteralPath $path -Destination "$path.bak" -Force
        [IO.File]::WriteAllText($path, $updated, [Text.UTF8Encoding]::new($false))
        Write-StartupLog "Updated optional $plugin input; backup: $path.bak"
    }
}

function Clear-RemovedPluginConfigs {
    $pendingDir = Join-Path $root '.runtime\plugin-config-removals'
    if (-not (Test-Path -LiteralPath $pendingDir)) { return }
    $allowed = @('mqtt','modbus','opcua','network-diagnostics','email-monitoring','server-monitoring','desktop-monitoring','docker','kubernetes','mongodb','mysql','redis','sql','sqlserver','postgresql','win-eventlog','influxdb','internal','exec','http','http-listener','nvidia','s7','syslog','cisco-telemetry','system','opentelemetry','nginx','csv','grok')
    $changed = $false
    foreach ($marker in Get-ChildItem -LiteralPath $pendingDir -Filter '*.pending' -File) {
        $kind = $marker.BaseName
        if ($kind -notin $allowed) { continue }
        $configPath = Join-Path $env:ProgramFiles "IIIOT-Veda\config\mai-$kind.conf"
        try {
            if (Test-Path -LiteralPath $configPath) { Remove-Item -LiteralPath $configPath -Force }
            Remove-Item -LiteralPath $marker.FullName -Force
            $changed = $true
            Write-StartupLog "Removed $kind input configuration."
        } catch { Write-StartupLog "Could not remove $kind configuration: $($_.Exception.Message)" }
    }
    if ($changed -and (Get-Service -Name telegraf -ErrorAction SilentlyContinue).Status -eq 'Running') {
        Restart-Service -Name telegraf -ErrorAction Stop
        Write-StartupLog 'Restarted Telegraf after plugin configuration removal.'
    }
}

if ($Install) {
    $admin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $admin) { throw 'Run -Install once in Administrator PowerShell.' }
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    foreach ($old in @('IIIOT-Veda-InfluxDB3', 'IIIOT-Veda-Backend', 'IIIOT-Veda-DevFrontend')) {
        if (Get-ScheduledTask -TaskName $old -ErrorAction SilentlyContinue) { Unregister-ScheduledTask -TaskName $old -Confirm:$false }
    }
    Set-Service -Name telegraf -StartupType Automatic
    Write-Host "Installed one startup task: $taskName. Start it now with Start-ScheduledTask -TaskName '$taskName'. Logs: $logDir"
    return
}

Write-StartupLog 'IIIOT-Veda startup supervisor started.'
$influxExe = 'C:\influxdb3-core\influxdb3.exe'
$pythonExe = Join-Path $root 'backend\venv\Scripts\python.exe'
$npmExe = 'C:\Program Files\nodejs\npm.cmd'
$frontendDir = Join-Path $root 'frontend'
$dockerWasAvailable = $false
$kubernetesWasAvailable = $false
while ($true) {
    try {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        Start-Component 'influxdb3' $influxExe @('serve', '--node-id', 'node0', '--object-store', 'file', '--data-dir', 'C:\influxdb3-core\data', '--http-bind', '127.0.0.1:8181') (Split-Path $influxExe) 8181
        Start-Component 'backend' $pythonExe @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8005') (Join-Path $root 'backend') 8005
        if (Test-Path -LiteralPath (Join-Path $frontendDir 'node_modules')) {
            Start-Component 'frontend' $npmExe @('run', 'dev', '--', '--host', '0.0.0.0', '--port', '3005', '--strictPort') $frontendDir 3005
        } else { Write-StartupLog 'Frontend node_modules missing; run npm ci in frontend.' }
        Clear-RemovedPluginConfigs
        Set-OptionalInput 'mongodb'
        Set-OptionalInput 'docker'
        Set-OptionalInput 'kubernetes'
        $service = Get-Service -Name telegraf -ErrorAction Stop
        if ($service.Status -ne 'Running') {
            Start-Service -Name telegraf -ErrorAction Stop
            Write-StartupLog 'Started Telegraf service.'
        } else {
            $dockerAvailable = Test-LocalPort 2375
            $kubernetesAvailable = Test-LocalPort 18081
            if (($dockerAvailable -and -not $dockerWasAvailable) -or ($kubernetesAvailable -and -not $kubernetesWasAvailable)) {
                Restart-Service -Name telegraf -ErrorAction Stop
                Write-StartupLog 'Restarted Telegraf after Docker or Kubernetes endpoint became available.'
            }
        }
        $dockerWasAvailable = Test-LocalPort 2375
        $kubernetesWasAvailable = Test-LocalPort 18081
    } catch { Write-StartupLog "Startup check failed: $($_.Exception.Message)" }
    Start-Sleep -Seconds 30
}
