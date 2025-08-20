#!/usr/bin/env pwsh

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " WhatsApp Card Manager - Frontend App" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if dependencies are installed
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "Dependencies installed successfully!" -ForegroundColor Green
}

# Check if .env file exists
if (!(Test-Path ".env")) {
    Write-Host ""
    Write-Host "Warning: .env file not found!" -ForegroundColor Yellow
    Write-Host "Please create a .env file with your Firebase and Gemini API keys." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to continue anyway"
}

Write-Host "Starting Frontend Server (Vite)..." -ForegroundColor Green
Write-Host "Application will run on: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "The frontend will automatically connect to the backend at localhost:5000" -ForegroundColor Yellow
Write-Host "Make sure the backend server is running first!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Start frontend server
npx vite --config vite.dev.config.ts