param([int]$SqlServerPort = 0)

$ErrorActionPreference = 'Stop'

$ConfigPath = Join-Path $env:ProgramFiles 'IIIOT-Veda\config\mai-sqlserver.conf'
if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "SQL Server monitoring config was not found at $ConfigPath"
}

$Config = Get-Content -LiteralPath $ConfigPath -Raw
$Config = $Config.Replace(
    'include_query = ["PerformanceCounters", "WaitStatsCategorized", "DatabaseIO", "ServerProperties"]',
    'include_query = ["SQLServerPerformanceCounters", "SQLServerWaitStatsCategorized", "SQLServerDatabaseIO", "SQLServerProperties"]'
)
if ($SqlServerPort -gt 0) {
    $Config = [regex]::Replace(
        $Config,
        '(?i)(Server=127\.0\.0\.1;Port=)\d+',
        [System.Text.RegularExpressions.MatchEvaluator]{ param($Match) $Match.Groups[1].Value + $SqlServerPort }
    )
}
[System.IO.File]::WriteAllText($ConfigPath, $Config, [System.Text.UTF8Encoding]::new($false))

Restart-Service -Name telegraf -Force
(Get-Service telegraf).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
Write-Output 'SQL Server query names were repaired and IIIOT-Veda is running.'
