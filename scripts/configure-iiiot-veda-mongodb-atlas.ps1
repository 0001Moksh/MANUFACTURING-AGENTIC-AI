$ErrorActionPreference = 'Stop'

$IsAdministrator = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsAdministrator) { throw 'Run this script from Administrator PowerShell.' }

$ConfigPath = Join-Path $env:ProgramFiles 'IIIOT-Veda\config\mai-mongodb.conf'
if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "MongoDB monitoring config was not found at $ConfigPath"
}

$Config = Get-Content -LiteralPath $ConfigPath -Raw
$Settings = @(
    '  startup_error_behavior = "ignore"',
    '  tls_enable = true',
    '  tls_min_version = "TLS12"',
    '  disconnected_servers_behavior = "skip"'
)
foreach ($Setting in $Settings) {
    $Name = ($Setting.Trim() -split '\s*=\s*', 2)[0]
    if ($Config -match "(?m)^\s*$Name\s*=") {
        $Config = [regex]::Replace($Config, "(?m)^\s*$Name\s*=.*$", $Setting)
    } else {
        $Config = $Config.Replace('[[inputs.mongodb]]', "[[inputs.mongodb]]`r`n$Setting")
    }
}
Copy-Item -LiteralPath $ConfigPath -Destination "$ConfigPath.bak" -Force
[System.IO.File]::WriteAllText($ConfigPath, $Config, [System.Text.UTF8Encoding]::new($false))

if ((Get-Service telegraf).Status -eq 'Running') { Restart-Service -Name telegraf -Force }
else { Start-Service -Name telegraf }
(Get-Service telegraf).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
Write-Output 'MongoDB Atlas TLS settings are configured and IIIOT-Veda is running.'
