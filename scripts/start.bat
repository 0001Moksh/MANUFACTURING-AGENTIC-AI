@echo off
setlocal
where docker >nul 2>nul || (echo Docker Desktop is not installed or not on PATH. & exit /b 1)
docker info >nul 2>nul || (echo Docker Desktop is not running. Start it and try again. & exit /b 1)
if not exist .env (
  copy .env.example .env >nul
  echo Created .env. Set the CHANGE_ME values, then run start.bat again.
  exit /b 1
)
findstr /C:"CHANGE_ME" .env >nul && (echo .env still contains CHANGE_ME values. Update them before starting. & exit /b 1)
docker compose pull
if errorlevel 1 exit /b 1
docker compose up -d --build
if errorlevel 1 exit /b 1
echo.
echo Waiting for the application health check...
for /L %%i in (1,1,60) do (
  curl -fsS http://localhost:8080/ >nul 2>nul && goto ready
  timeout /t 2 /nobreak >nul
)
echo Application did not become ready. Run: docker compose logs --tail=200
exit /b 1
:ready
echo Application ready: http://localhost:8080
endlocal
