param([switch]$IncludeDevFrontend)

# Run once in Administrator PowerShell on the Windows host.
$ErrorActionPreference = 'Stop'
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw 'Run this script from Administrator PowerShell.' }
$runner = Join-Path $PSScriptRoot 'run-windows-component.ps1'
if (-not (Test-Path -LiteralPath $runner)) { throw "Missing component runner: $runner" }

$components = @('InfluxDB3', 'Backend')
if ($IncludeDevFrontend) { $components += 'DevFrontend' }
foreach ($component in $components) {
  $taskName = "IIIOT-Veda-$component"
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`" -Component $component"
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -MultipleInstances IgnoreNew
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
  Write-Host "Registered $taskName for startup."
}
Set-Service -Name telegraf -StartupType Automatic
Write-Host 'Telegraf is Automatic. Reboot and verify each task and endpoint.'
