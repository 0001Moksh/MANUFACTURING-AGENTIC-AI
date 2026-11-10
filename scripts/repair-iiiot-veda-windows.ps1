$ErrorActionPreference = 'Stop'
$RepairLog = 'D:\IIIOT-Infotech\MANUFACTURING-AGENTIC-AI\backend\logs\iiiot-veda-repair.log'
trap {
    $_ | Format-List * -Force | Out-File -LiteralPath $RepairLog -Encoding utf8
    exit 1
}

$ConfigPath = Join-Path $env:ProgramFiles 'IIIOT-Veda\config\mai-server-monitoring.conf'
if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Server Monitoring config was not found at $ConfigPath"
}

$Config = Get-Content -LiteralPath $ConfigPath -Raw
$ProcstatBlock = '(?ms)^\[\[inputs\.procstat\]\]\s*\r?\n(?:^(?!\[\[).*(?:\r?\n|$))*'
$Config = [regex]::Replace($Config, $ProcstatBlock, '')
[System.IO.File]::WriteAllText($ConfigPath, $Config, [System.Text.UTF8Encoding]::new($false))

$Runtime = Get-ChildItem (Join-Path $env:ProgramFiles 'IIIOT-Veda') -Filter telegraf.exe -File -Recurse |
    Select-Object -First 1
if (-not $Runtime) { throw 'IIIOT-Veda runtime was not found.' }

$PreviousErrorPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& $Runtime.FullName --config-directory (Split-Path $ConfigPath) --test *> $null
$ValidationExitCode = $LASTEXITCODE
$ErrorActionPreference = $PreviousErrorPreference
if ($ValidationExitCode -ne 0) { throw 'IIIOT-Veda configuration validation failed.' }

Start-Service -Name telegraf
(Get-Service telegraf).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
'IIIOT-Veda configuration is valid and the service is running.' | Out-File -LiteralPath $RepairLog -Encoding utf8
Write-Output 'IIIOT-Veda configuration is valid and the service is running.'
