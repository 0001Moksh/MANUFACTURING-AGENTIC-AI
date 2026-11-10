# Start the existing minikube cluster and the local API proxy used by IIIOT-Veda.
$ErrorActionPreference = 'Stop'
if (-not (Get-Command minikube -ErrorAction SilentlyContinue)) { throw 'minikube is not installed or not on PATH.' }
if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) { throw 'kubectl is not installed or not on PATH.' }
& minikube start -p minikube
if ($LASTEXITCODE -ne 0) { throw 'minikube failed to start. Check that Docker Desktop is running.' }
$listener = Get-NetTCPConnection -State Listen -LocalPort 18081 -ErrorAction SilentlyContinue
if (-not $listener) {
  Start-Process -FilePath (Get-Command kubectl).Source -ArgumentList @('--context=minikube', 'proxy', '--port=18081', '--address=127.0.0.1', '--accept-hosts=^127\.0\.0\.1$') -WindowStyle Hidden | Out-Null
  Start-Sleep -Seconds 2
}
$response = Invoke-WebRequest 'http://127.0.0.1:18081/api/v1/nodes/minikube/proxy/stats/summary' -TimeoutSec 10
if ($response.StatusCode -ne 200) { throw "Kubernetes statistics request returned $($response.StatusCode)." }
Write-Host 'Minikube Kubelet is available to IIIOT-Veda at localhost:18081.'
