@echo off
echo Starting WhatsApp Business Card Manager...
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
    echo See WINDOWS_SETUP_GUIDE.md for instructions.
    echo.
    pause
)

REM Start the development server (Windows compatible)
echo Starting development server...
echo The application will be available at http://localhost:5000
echo.
set NODE_ENV=development && npx tsx server/index.ts