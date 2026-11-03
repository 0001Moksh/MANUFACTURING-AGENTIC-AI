$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$PasswordLine = Get-Content (Join-Path $ProjectRoot '.env') |
    Where-Object { $_ -match '^\s*SQLSERVER_PASSWORD\s*=' } |
    Select-Object -Last 1
if (-not $PasswordLine) { throw 'SQLSERVER_PASSWORD is missing from the project .env.' }
$SqlPassword = ($PasswordLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
if ([string]::IsNullOrWhiteSpace($SqlPassword)) { throw 'SQLSERVER_PASSWORD is empty.' }

$Connection = [System.Data.SqlClient.SqlConnection]::new(
    'Server=.\SQLEXPRESS;Database=master;Integrated Security=True;Encrypt=False;TrustServerCertificate=True;'
)
try {
    $Connection.Open()
    $EscapedPassword = $SqlPassword.Replace("'", "''")
    $Command = $Connection.CreateCommand()
    $Command.CommandText = "ALTER LOGIN [sa] ENABLE; ALTER LOGIN [sa] WITH PASSWORD = N'$EscapedPassword' UNLOCK;"
    [void]$Command.ExecuteNonQuery()
} finally {
    $Connection.Dispose()
    $SqlPassword = $null
}

Restart-Service -Name 'MSSQL$SQLEXPRESS' -Force
(Get-Service 'MSSQL$SQLEXPRESS').WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
Restart-Service -Name telegraf -Force
(Get-Service telegraf).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
Write-Output 'SQLEXPRESS authentication and IIIOT-Veda were restarted successfully.'
