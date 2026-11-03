$ErrorActionPreference = 'Stop'

$ConfigPath = Join-Path $env:ProgramFiles 'IIIOT-Veda\config\mai-mongodb.conf'
if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "MongoDB monitoring config was not found at $ConfigPath"
}

$Config = Get-Content -LiteralPath $ConfigPath -Raw
$Settings = @(
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
[System.IO.File]::WriteAllText($ConfigPath, $Config, [System.Text.UTF8Encoding]::new($false))

Restart-Service -Name telegraf -Force
(Get-Service telegraf).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
Write-Output 'MongoDB Atlas TLS settings are configured and IIIOT-Veda is running.'
