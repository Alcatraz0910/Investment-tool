@echo off
title Pulse — Starting...
cd /d "%~dp0pulse"

echo Starting Pulse dev server...
start "" /B cmd /c "timeout /t 6 /nobreak >nul && start http://localhost:3000"

title Pulse — Running on localhost:3000
echo.
echo  Pulse is running at http://localhost:3000
echo  Press Ctrl+C to stop the server.
echo.
npm run dev
