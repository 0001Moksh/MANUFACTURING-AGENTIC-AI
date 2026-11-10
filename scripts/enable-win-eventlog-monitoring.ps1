# Run from an Administrator PowerShell after installing IIIOT-Veda.
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'win-eventlog-monitoring.conf'
$destination = 'C:\Program Files\IIIOT-Veda\config\mai-win-eventlog.conf'
if (-not (Test-Path -LiteralPath $source)) { throw "Missing config: $source" }
if (-not (Test-Path -LiteralPath (Split-Path $destination))) { throw 'IIIOT-Veda is not installed.' }
Copy-Item -LiteralPath $source -Destination $destination -Force
Restart-Service -Name telegraf
(Get-Service -Name telegraf).WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
& eventcreate.exe /T INFORMATION /ID 1000 /L APPLICATION /SO IIIOT-Veda-Test /D 'IIIOT-Veda Windows Event Log input verification'
if ($LASTEXITCODE -ne 0) { throw 'Could not write the test Application event. Run this script as Administrator.' }
Write-Host 'Test event written. Wait 10 seconds, then press Run for Windows Event Log Monitoring.'
