@echo off
title AI Council Commander
echo ============================================
echo   AI Council Commander v3.1.0
echo ============================================
echo.
echo Starting application...
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3001
echo.
echo Press Ctrl+C to stop the application
echo ============================================
echo.

cd /d "%~dp0"
call npm run dev

pause
