@echo off
echo ========================================
echo  WhatsApp Card Manager - Backend Server
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist server (
    echo Error: server folder not found
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist node_modules (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Check if .env file exists
if not exist .env (
    echo.
    echo Warning: .env file not found!
    echo Please create a .env file with your Firebase and Gemini API keys.
    echo.
    pause
)

echo Starting Backend Server (Express)...
echo Server will run on: http://localhost:5000
echo API endpoints available at: http://localhost:5000/api/
echo.
echo Press Ctrl+C to stop the server
echo.

cd server
set NODE_ENV=development && npx tsx index.ts