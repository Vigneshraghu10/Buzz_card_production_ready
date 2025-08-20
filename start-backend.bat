@echo off
echo Starting Backend Server...
echo Backend will run on: http://localhost:5000
echo.

if not exist server (
    echo Error: server folder not found
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

if not exist .env (
    echo Warning: .env file not found
    echo Please create .env with your API keys
    echo.
    pause
)

cd server
set NODE_ENV=development && npx tsx index.ts