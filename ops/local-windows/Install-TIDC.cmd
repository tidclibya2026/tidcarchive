@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-TIDC.ps1"
if errorlevel 1 (
  echo.
  echo Installation did not complete. Review the PowerShell message above.
  pause
  exit /b %errorlevel%
)
pause
