@echo off
echo ========================================
echo  Port 5000 Fix - WhatsApp Card Manager
echo ========================================
echo.
echo This script will help fix the "port 5000 already in use" error
echo.

echo Checking what's using port 5000...
netstat -ano | findstr :5000

echo.
echo To kill the process using port 5000, find the PID number from above
echo and use: taskkill /PID [PID_NUMBER] /F
echo.
echo Or you can restart your computer to free up all ports.
echo.

set /p pid="Enter the PID number to kill (or press Enter to skip): "
if not "%pid%"=="" (
    taskkill /PID %pid% /F
    echo Process %pid% has been terminated.
) else (
    echo No PID entered, skipping...
)

echo.
echo Port should now be available. Try running the application again.
pause