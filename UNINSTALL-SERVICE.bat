@echo off
REM ScaleCmdBridge - Windows Service Uninstallation Script
REM This script removes ScaleCmdBridge Windows Service
REM Must be run as Administrator

setlocal enabledelayedexpansion

REM Quiet mode (for installer)
set QUIET=0
if /I "%~1"=="/quiet" set QUIET=1
if "%INSTALLER_MODE%"=="1" set QUIET=1

echo.
echo ========================================
echo ScaleCmdBridge - Service Uninstallation
echo ========================================
echo.

REM Check for administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator.
    echo Right-click and select "Run as administrator"
    if %QUIET%==0 pause
    exit /b 1
)

set "INSTALL_DIR=%ProgramFiles%\ScaleCmdBridge"
set "NSSM_EXE=%INSTALL_DIR%\nssm.exe"
set "SERVICE_NAME=ScaleCmdBridge"

echo Service Name: %SERVICE_NAME%
echo.

REM Check if service exists
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorLevel% neq 0 (
    echo Service %SERVICE_NAME% is not installed.
    if %QUIET%==0 pause
    exit /b 0
)

REM Check if service is running
sc query "%SERVICE_NAME%" | find "RUNNING" >nul
if %errorLevel% equ 0 (
    echo Service is currently running.
    echo.
    if %QUIET%==1 (
        echo Quiet mode: stopping and removing service without prompt...
        if exist "%NSSM_EXE%" (
            "%NSSM_EXE%" stop "%SERVICE_NAME%"
        ) else (
            net stop "%SERVICE_NAME%"
        )
        timeout /t 3 /nobreak >nul
    ) else (
        choice /C YN /M "Do you want to stop and remove the service"
        if errorlevel 2 exit /b 0
        if errorlevel 1 (
            echo.
            echo Stopping service...
            if exist "%NSSM_EXE%" (
                "%NSSM_EXE%" stop "%SERVICE_NAME%"
            ) else (
                net stop "%SERVICE_NAME%"
            )
            timeout /t 3 /nobreak >nul
        )
    )
) else (
    echo Service is not running.
    echo.
    if %QUIET%==0 (
        choice /C YN /M "Do you want to remove the service"
        if errorlevel 2 exit /b 0
    )
)

echo.
echo Removing service...

REM Remove service using NSSM if available, otherwise use sc
if exist "%NSSM_EXE%" (
    "%NSSM_EXE%" remove "%SERVICE_NAME%" confirm
) else (
    sc delete "%SERVICE_NAME%"
)

if %errorLevel% equ 0 (
    echo.
    echo Service removed successfully!
    echo.
    echo Note: Configuration and logs in %ProgramData%\ScaleCmdBridge\ are preserved.
    echo To remove them completely, delete the directory manually.
) else (
    echo.
    echo ERROR: Failed to remove service
    echo You may need to remove it manually using:
    echo   sc delete "%SERVICE_NAME%"
)

echo.
if %QUIET%==0 pause

