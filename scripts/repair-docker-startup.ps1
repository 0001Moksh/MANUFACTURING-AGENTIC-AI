# Run in Administrator PowerShell when Docker is optional on this host.
$ErrorActionPreference = 'Stop'
$configPath = 'C:\Program Files\IIIOT-Veda\config\mai-docker.conf'
if (-not (Test-Path -LiteralPath $configPath)) { throw "Missing Docker input config: $configPath" }
$configText = Get-Content -LiteralPath $configPath -Raw
if ($configText -notmatch '(?m)^\s*\[\[inputs\.docker\]\]\s*$') { throw 'Docker input block was not found.' }
$updated = $configText -replace '(?m)^\s*startup_error_behavior\s*=\s*"[^"]*"\s*\r?\n', ''
$updated = $updated -replace '(?m)^(\s*\[\[inputs\.docker\]\]\s*\r?\n)', "`$1  startup_error_behavior = `"ignore`"`r`n"
if ($updated -ne $configText) {
  Copy-Item -LiteralPath $configPath -Destination "$configPath.bak" -Force
  Set-Content -LiteralPath $configPath -Value $updated -Encoding utf8
}
$service = Get-Service -Name telegraf
if ($service.Status -eq 'Running') { Restart-Service -Name telegraf }
else { Start-Service -Name telegraf }
Start-Sleep -Seconds 5
$service = Get-Service -Name telegraf
if ($service.Status -ne 'Running') { throw "Telegraf is $($service.Status). Check its latest Application event for the next startup error." }
Write-Host 'Telegraf is running. Docker remains disconnected until its daemon is available and the service is restarted.'
