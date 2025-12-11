@echo off
REM ScaleIT Bridge - Start Backend + Frontend Development Servers
REM This script starts both backend (Rust) and frontend (React) servers
REM with proper MinGW environment configuration

setlocal enabledelayedexpansion

echo.
echo ========================================
echo ScaleIT Bridge - Development Servers
echo ========================================
echo.

REM Check if PowerShell is available
where powershell.exe >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: PowerShell not found. Please install PowerShell.
    pause
    exit /b 1
)

REM Check if Node.js is available
where node.exe >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Node.js not found. Please install Node.js.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/2] Starting Backend Server (Rust)...
echo This will open in a new window.
echo.

REM Start backend in a new window
start "ScaleIT Bridge Backend" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "run-backend.ps1"

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend Server (React)...
echo This will open in a new window.
echo.

REM Start frontend using PowerShell (better PATH inheritance)
REM PowerShell inherits environment variables better than cmd
start "ScaleIT Bridge Frontend" powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "cd '%~dp0'; npm run dev"

echo.
echo ========================================
echo Servers Starting...
echo ========================================
echo.
echo Backend:  http://localhost:8080
echo Frontend: http://localhost:5173
echo.
echo Both servers are running in separate windows.
echo Close the windows to stop the servers.
echo.
pause

