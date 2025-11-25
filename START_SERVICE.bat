@echo off
REM ScaleIT Bridge Service Startup Script
REM Use this to manually start the service if needed

setlocal enabledelayedexpansion
set SERVICE_NAME=ScaleIT-Bridge

cls
echo.
echo ========================================
echo ScaleIT Bridge Service Startup
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script requires Administrator privileges.
    echo Please run as Administrator.
    pause
    exit /b 1
)

echo Starting service: %SERVICE_NAME%...
net start "%SERVICE_NAME%"

if %errorLevel% equ 0 (
    echo.
    echo [SUCCESS] Service started successfully!
    echo.
    echo Service Status:
    sc query %SERVICE_NAME%
    echo.
    echo Web UI: http://localhost:8080
) else (
    echo.
    echo [ERROR] Failed to start service
    echo.
    echo Please check:
    echo  1. Service is installed: sc query %SERVICE_NAME%
    echo  2. Configuration is valid: check .env file
    echo  3. Port 8080 is available: netstat -ano | findstr 8080
    echo.
    sc query %SERVICE_NAME%
)

echo.
pause
