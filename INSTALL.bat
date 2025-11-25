@echo off
REM ScaleIT Bridge Windows Installer Script
REM This script sets up ScaleIT Bridge as a Windows service

setlocal enabledelayedexpansion
set SCRIPT_DIR=%~dp0
set SERVICE_NAME=ScaleIT-Bridge
set SERVICE_DISPLAY_NAME=ScaleIT Bridge Scale Command Service
set BINARY_PATH=%SCRIPT_DIR%bin\scaleit-bridge.exe
set INSTALL_PATH=C:\Program Files\ScaleIT_Bridge

cls
echo.
echo ========================================
echo ScaleIT Bridge - Windows Installer
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

echo [1/4] Checking prerequisites...
if not exist "%BINARY_PATH%" (
    echo ERROR: Binary not found at %BINARY_PATH%
    echo Please ensure the package is properly extracted.
    pause
    exit /b 1
)
echo  - Binary found: OK

if not exist "%SCRIPT_DIR%config\devices.json" (
    echo WARNING: Configuration file not found at %SCRIPT_DIR%config\devices.json
    echo A default configuration will be created.
)
echo  - Configuration: OK

echo.
echo [2/4] Installing files to %INSTALL_PATH%...
if not exist "%INSTALL_PATH%" (
    mkdir "%INSTALL_PATH%"
    echo  - Created directory: %INSTALL_PATH%
)

xcopy "%SCRIPT_DIR%*.*" "%INSTALL_PATH%\" /E /I /Y >nul 2>&1
if %errorLevel% equ 0 (
    echo  - Files copied: OK
) else (
    echo ERROR: Failed to copy files
    pause
    exit /b 1
)

echo.
echo [3/4] Creating Windows Service...

REM Check if service already exists
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo  - Service already exists, stopping...
    net stop "%SERVICE_NAME%" >nul 2>&1
    echo  - Removing existing service...
    sc delete "%SERVICE_NAME%" >nul 2>&1
    timeout /t 2 /nobreak >nul
)

REM Create new service
sc create %SERVICE_NAME% binPath= "%INSTALL_PATH%\bin\scaleit-bridge.exe" ^
    DisplayName= "%SERVICE_DISPLAY_NAME%" ^
    start= auto >nul 2>&1

if %errorLevel% equ 0 (
    echo  - Service created: OK
) else (
    echo ERROR: Failed to create service
    pause
    exit /b 1
)

REM Configure service recovery
sc failure %SERVICE_NAME% reset= 300 actions= restart/60000/restart/120000/none >nul 2>&1
echo  - Service recovery configured: OK

echo.
echo [4/4] Configuring service...

REM Create .env file if it doesn't exist
if not exist "%INSTALL_PATH%\.env" (
    echo # ScaleIT Bridge Configuration > "%INSTALL_PATH%\.env"
    echo CONFIG_PATH=%INSTALL_PATH%\config\devices.json >> "%INSTALL_PATH%\.env"
    echo RUST_LOG=info >> "%INSTALL_PATH%\.env"
    echo PORT=8080 >> "%INSTALL_PATH%\.env"
    echo RUST_BACKTRACE=1 >> "%INSTALL_PATH%\.env"
    echo  - Created .env file: OK
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Service Name: %SERVICE_NAME%
echo Install Path: %INSTALL_PATH%
echo.
echo Next Steps:
echo  1. Edit configuration: %INSTALL_PATH%\.env
echo  2. Edit devices: %INSTALL_PATH%\config\devices.json
echo  3. Start service: net start "%SERVICE_NAME%"
echo  4. Access web UI: http://localhost:8080
echo.
echo Service Commands:
echo  - Start:   net start "%SERVICE_NAME%"
echo  - Stop:    net stop "%SERVICE_NAME%"
echo  - Restart: net stop "%SERVICE_NAME%" ^& net start "%SERVICE_NAME%"
echo  - Status:  sc query "%SERVICE_NAME%"
echo  - Remove:  sc delete "%SERVICE_NAME%"
echo.
pause
