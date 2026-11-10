@echo off
setlocal
set "IIIOT_START_BAT=%~f0"
set "IIIOT_SUPERVISOR=%~dp0start-iiiot-veda-windows.ps1"
if /I "%~1"=="install" goto install
if /I "%~1"=="run" goto run
if /I "%~1"=="stop" goto stop
echo Usage: start.bat install ^| run ^| stop
exit /b 2

:install
if not exist "%IIIOT_SUPERVISOR%" (echo Missing Windows supervisor: %IIIOT_SUPERVISOR% & exit /b 1)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Run from Administrator Command Prompt'}; $a=New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/d /c ""' + $env:IIIOT_START_BAT + '" run"'); $t=New-ScheduledTaskTrigger -AtStartup; $p=New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest; $s=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -MultipleInstances IgnoreNew; Register-ScheduledTask -TaskName 'IIIOT-Veda-Startup' -Action $a -Trigger $t -Principal $p -Settings $s -Force | Out-Null; Set-Service telegraf -StartupType Automatic; Start-ScheduledTask -TaskName 'IIIOT-Veda-Startup'"
if errorlevel 1 exit /b 1
echo IIIOT-Veda startup task installed and started.
exit /b 0

:run
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%IIIOT_SUPERVISOR%"
exit /b %errorlevel%

:stop
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; Stop-ScheduledTask -TaskName 'IIIOT-Veda-Startup'; Disable-ScheduledTask -TaskName 'IIIOT-Veda-Startup'"
exit /b %errorlevel%
