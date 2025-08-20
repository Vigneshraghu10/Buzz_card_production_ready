@echo off
echo ========================================
echo  WhatsApp Card Manager - Full Stack
echo ========================================
echo.
echo Starting both Frontend and Backend servers...
echo.
echo Backend will run on: http://localhost:5000
echo Frontend will run on: http://localhost:3000
echo.
echo Two command prompt windows will open:
echo 1. Backend Server (Express + API)
echo 2. Frontend Server (React + Vite)
echo.
echo Close this window or press Ctrl+C to stop
echo.

REM Start backend in new window
start "Backend Server - WhatsApp Card Manager" start-backend.bat

REM Wait a moment for backend to start
timeout /t 3 /nobreak

REM Start frontend in new window
start "Frontend App - WhatsApp Card Manager" start-frontend.bat

echo.
echo Both servers are starting...
echo.
echo Once both servers are running:
echo - Open your browser and go to: http://localhost:3000
echo.
pause