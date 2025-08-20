@echo off
echo ========================================
echo  WhatsApp Card Manager - Frontend App
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

echo Starting Frontend Server (Vite)...
echo Application will run on: http://localhost:3000
echo.
echo The frontend will automatically connect to the backend at localhost:5000
echo Make sure the backend server is running first!
echo.
echo Press Ctrl+C to stop the server
echo.

npx vite --config vite.dev.config.ts