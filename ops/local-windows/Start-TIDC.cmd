@echo off
setlocal
cd /d "%~dp0"
docker compose --env-file .env -f docker-compose.yml up -d
if errorlevel 1 exit /b %errorlevel%
echo TIDC is running. Open the HTTPS address configured in ops\local-windows\.env
