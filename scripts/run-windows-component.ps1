param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('InfluxDB3', 'Backend', 'DevFrontend')]
  [string]$Component
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent

switch ($Component) {
  'InfluxDB3' {
    $binary = 'C:\influxdb3-core\influxdb3.exe'
    $dataDir = 'C:\influxdb3-core\data'
    if (-not (Test-Path -LiteralPath $binary)) { throw "Missing InfluxDB 3 executable: $binary" }
    if (-not (Test-Path -LiteralPath (Join-Path $dataDir 'node0'))) { throw "Existing node0 data missing: $dataDir" }
    Set-Location -LiteralPath (Split-Path $binary)
    & $binary serve --node-id node0 --object-store file --data-dir $dataDir --http-bind 127.0.0.1:8181
  }
  'Backend' {
    $python = Join-Path $projectRoot 'backend\venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $python)) { throw "Missing backend virtual environment: $python" }
    Set-Location -LiteralPath (Join-Path $projectRoot 'backend')
    & $python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
  }
  'DevFrontend' {
    $npm = 'C:\Program Files\nodejs\npm.cmd'
    if (-not (Test-Path -LiteralPath $npm)) { throw "Missing Node.js npm: $npm" }
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'frontend\node_modules'))) { throw 'Run npm ci in frontend first.' }
    Set-Location -LiteralPath (Join-Path $projectRoot 'frontend')
    & $npm run dev -- --host 0.0.0.0 --port 3000 --strictPort
  }
}

throw "$Component exited. Check its Windows startup task history and application logs."
