@echo off
REM ScaleCmdBridge - Stop Windows Service

setlocal

REM Get script directory
set "SCRIPT_DIR=%~dp0"
set "INSTALL_DIR=%ProgramFiles%\ScaleCmdBridge"
set "NSSM_EXE=%INSTALL_DIR%\nssm.exe"
set "SERVICE_NAME=ScaleCmdBridge"

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator.
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

REM Check if service exists
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Service %SERVICE_NAME% does not exist.
    echo Service may not be installed.
    pause
    exit /b 1
)

REM Check if NSSM exists
if not exist "%NSSM_EXE%" (
    echo ERROR: NSSM not found at %NSSM_EXE%
    echo Please ensure NSSM is installed in the installation directory.
    pause
    exit /b 1
)

echo Stopping %SERVICE_NAME% service...
echo.

REM Use NSSM to stop the service (more reliable for NSSM-managed services)
"%NSSM_EXE%" stop "%SERVICE_NAME%"

if %errorLevel% equ 0 (
    echo.
    echo Service stopped successfully!
    echo.
    sc query "%SERVICE_NAME%"
) else (
    echo.
    echo ERROR: Failed to stop service
    echo Service may not be running or may require administrator privileges
    echo.
    echo You can also try: net stop "%SERVICE_NAME%"
)

echo.
pause

