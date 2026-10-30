$ErrorActionPreference = 'Stop'
# Use the platform database without displaying credentials.
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DatabaseLine = Get-Content (Join-Path $ProjectRoot '.env') | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -Last 1
if (-not $DatabaseLine) { throw 'DATABASE_URL is missing from the project .env.' }
$DatabaseUrl = ($DatabaseLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
$DatabaseUrl = $DatabaseUrl -replace '^postgresql\+asyncpg:', 'postgresql:'
$DatabaseUri = [Uri]$DatabaseUrl
if ($DatabaseUri.Scheme -notin @('postgres', 'postgresql') -or $DatabaseUri.Host -in @('', 'HOST') -or $DatabaseUri.AbsolutePath -in @('/', '/DATABASE')) {
    throw 'The project DATABASE_URL must contain real PostgreSQL connection details.'
}
$ConfigPath = Join-Path $env:ProgramFiles 'Telegraf\telegraf.d\mai-cpu.conf'
$Config = Get-Content -LiteralPath $ConfigPath -Raw
$ConnectionLine = '  connection = ' + (ConvertTo-Json -InputObject $DatabaseUrl -Compress)
if ($Config -notmatch '(?m)^\s*connection\s*=.*$') { throw 'No PostgreSQL connection setting was found.' }
$Config = [regex]::Replace($Config, '(?m)^\s*connection\s*=.*$', [System.Text.RegularExpressions.MatchEvaluator]{ param($Match) $ConnectionLine })
[System.IO.File]::WriteAllText($ConfigPath, $Config, [System.Text.UTF8Encoding]::new($false))
Restart-Service -Name telegraf -Force
(Get-Service telegraf).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
Write-Output 'Telegraf now uses the project PostgreSQL database and the service is running.'
