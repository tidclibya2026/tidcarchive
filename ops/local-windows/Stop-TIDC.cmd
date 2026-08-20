@echo off
setlocal
cd /d "%~dp0"
docker compose --env-file .env -f docker-compose.yml stop
