@echo off
setlocal
cd /d "%~dp0"
docker compose --env-file .env -f docker-compose.yml logs --tail 150 -f
