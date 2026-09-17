@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install Node.js, then run this file again.
  pause
  exit /b 1
)
echo Starting KAD Growth Academy on http://localhost:4173
echo Keep the server window open while using the site.
start "KAD Growth Server" /d "%~dp0" cmd /k "node scripts\serve.mjs --dist"
timeout /t 2 /nobreak >nul
start "" "http://localhost:4173"
endlocal
