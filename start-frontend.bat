@echo off
echo Starting Frontend Server...
echo Frontend will run on: http://localhost:3000
echo.

if not exist client (
    echo Error: client folder not found
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

cd client
npx vite