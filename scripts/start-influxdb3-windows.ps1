# Start the existing local InfluxDB 3 Core node used by IIIOT-Veda.
$ErrorActionPreference = 'Stop'
$binary = 'C:\influxdb3-core\influxdb3.exe'
$dataDir = 'C:\influxdb3-core\data'
if (-not (Test-Path -LiteralPath $binary)) { throw "InfluxDB 3 binary not found: $binary" }
if (-not (Test-Path -LiteralPath (Join-Path $dataDir 'node0'))) { throw "Existing node0 data not found under $dataDir" }
if (Get-NetTCPConnection -State Listen -LocalPort 8181 -ErrorAction SilentlyContinue) {
  Write-Host 'Port 8181 is already listening; InfluxDB 3 may already be running.'
  return
}
Start-Process -FilePath $binary -ArgumentList @('serve', '--node-id', 'node0', '--object-store', 'file', '--data-dir', $dataDir, '--http-bind', '127.0.0.1:8181') -WorkingDirectory (Split-Path $binary) -WindowStyle Hidden
Start-Sleep -Seconds 5
if (-not (Get-NetTCPConnection -State Listen -LocalPort 8181 -ErrorAction SilentlyContinue)) {
  throw 'InfluxDB 3 did not open port 8181. Run the same serve command interactively to inspect the startup error.'
}
Write-Host 'InfluxDB 3 is listening on 127.0.0.1:8181.'
