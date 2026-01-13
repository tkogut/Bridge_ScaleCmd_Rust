@echo off
REM ScaleCmdBridge - Windows Service Installation Script
REM This script installs ScaleCmdBridge as a Windows Service using NSSM
REM Must be run as Administrator

setlocal enabledelayedexpansion

REM Quiet mode (for installer)
set QUIET=0
if /I "%~1"=="/quiet" set QUIET=1
if "%INSTALLER_MODE%"=="1" set QUIET=1

echo.
echo ========================================
echo ScaleCmdBridge - Service Installation
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

REM Get script directory
set "SCRIPT_DIR=%~dp0"
set "INSTALL_DIR=%ProgramFiles%\ScaleCmdBridge"
set "NSSM_EXE=%INSTALL_DIR%\nssm.exe"
set "SERVICE_EXE=%INSTALL_DIR%\ScaleCmdBridge.exe"
set "SERVICE_NAME=ScaleCmdBridge"
set "SERVICE_DISPLAY_NAME=ScaleIT Bridge Service"
set "SERVICE_DESCRIPTION=Universal Industrial Scale Communication Bridge"

echo Installation directory: %INSTALL_DIR%
echo Service executable: %SERVICE_EXE%
echo.

REM Check if NSSM exists
if not exist "%NSSM_EXE%" (
    echo ERROR: NSSM not found at %NSSM_EXE%
    echo Please ensure NSSM is installed in the installation directory.
    if %QUIET%==0 pause
    exit /b 1
)

REM Check if service executable exists
if not exist "%SERVICE_EXE%" (
    echo ERROR: Service executable not found at %SERVICE_EXE%
    echo Please ensure ScaleCmdBridge.exe is in the installation directory.
    if %QUIET%==0 pause
    exit /b 1
)

REM Check if service already exists
sc query "%SERVICE_NAME%" >nul 2>&1
if %errorLevel% equ 0 (
    echo Service %SERVICE_NAME% already exists.
    echo.
    if %QUIET%==1 (
        echo Quiet mode: removing existing service without prompt...
        "%NSSM_EXE%" stop "%SERVICE_NAME%"
        "%NSSM_EXE%" remove "%SERVICE_NAME%" confirm
        timeout /t 2 /nobreak >nul
    ) else (
        choice /C YN /M "Do you want to remove the existing service and reinstall"
        if errorlevel 2 exit /b 0
        if errorlevel 1 (
            echo.
            echo Removing existing service...
            "%NSSM_EXE%" stop "%SERVICE_NAME%"
            "%NSSM_EXE%" remove "%SERVICE_NAME%" confirm
            timeout /t 2 /nobreak >nul
        )
    )
)

echo.
echo Installing Windows Service...
echo.

REM Install service using NSSM
"%NSSM_EXE%" install "%SERVICE_NAME%" "%SERVICE_EXE%"
if %errorLevel% neq 0 (
    echo ERROR: Failed to install service
    if %QUIET%==0 pause
    exit /b 1
)

REM Configure service
echo Configuring service...
"%NSSM_EXE%" set "%SERVICE_NAME%" AppDirectory "%INSTALL_DIR%"
"%NSSM_EXE%" set "%SERVICE_NAME%" DisplayName "%SERVICE_DISPLAY_NAME%"
"%NSSM_EXE%" set "%SERVICE_NAME%" Description "%SERVICE_DESCRIPTION%"
"%NSSM_EXE%" set "%SERVICE_NAME%" Start SERVICE_AUTO_START

REM Set environment variables (all at once using PowerShell for proper newline handling)
echo Configuring environment variables...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$env = 'CONFIG_PATH=%ProgramData%\ScaleCmdBridge\config\devices.json' + [Environment]::NewLine + 'WEB_PATH=%INSTALL_DIR%\web' + [Environment]::NewLine + 'PORT=8080' + [Environment]::NewLine + 'MQTT_ENABLED=true' + [Environment]::NewLine + 'MQTT_BROKER_URL=mqtt://localhost:1883' + [Environment]::NewLine + 'MQTT_TOPIC_PREFIX=scaleit'; & '%NSSM_EXE%' set '%SERVICE_NAME%' AppEnvironmentExtra $env"

REM Configure logging
"%NSSM_EXE%" set "%SERVICE_NAME%" AppStdout "%ProgramData%\ScaleCmdBridge\logs\service-stdout.log"
"%NSSM_EXE%" set "%SERVICE_NAME%" AppStderr "%ProgramData%\ScaleCmdBridge\logs\service-stderr.log"
"%NSSM_EXE%" set "%SERVICE_NAME%" AppRotateFiles 1
"%NSSM_EXE%" set "%SERVICE_NAME%" AppRotateOnline 1
"%NSSM_EXE%" set "%SERVICE_NAME%" AppRotateSeconds 86400
"%NSSM_EXE%" set "%SERVICE_NAME%" AppRotateBytes 10485760

REM Create ProgramData directories if they don't exist
if not exist "%ProgramData%\ScaleCmdBridge\config" (
    mkdir "%ProgramData%\ScaleCmdBridge\config"
)
if not exist "%ProgramData%\ScaleCmdBridge\logs" (
    mkdir "%ProgramData%\ScaleCmdBridge\logs"
)

REM Copy default config if it doesn't exist
if not exist "%ProgramData%\ScaleCmdBridge\config\devices.json" (
    if exist "%INSTALL_DIR%\config\devices.json" (
        copy "%INSTALL_DIR%\config\devices.json" "%ProgramData%\ScaleCmdBridge\config\devices.json" >nul
        echo Default configuration copied to ProgramData
    ) else (
        echo Creating default configuration...
        echo {^"devices^":{}} > "%ProgramData%\ScaleCmdBridge\config\devices.json"
    )
)

echo.
echo Configuring Windows Firewall...
echo.

REM Add firewall rule for ScaleIT Bridge (allow from local network)
set "FIREWALL_RULE_NAME=ScaleIT Bridge - TCP Port 8080"
set "FIREWALL_RULE_DESC=Allows access to ScaleIT Bridge service from local network (Private profile only)"

REM Check if rule already exists
netsh advfirewall firewall show rule name="%FIREWALL_RULE_NAME%" >nul 2>&1
if %errorLevel% equ 0 (
    echo Firewall rule already exists, updating...
    netsh advfirewall firewall delete rule name="%FIREWALL_RULE_NAME%" >nul 2>&1
)

REM Remove old firewall rule if it exists (for backward compatibility)
netsh advfirewall firewall delete rule name="ScaleCmdBridge" >nul 2>&1

REM Add firewall rule for Private network profile (local network)
REM This allows connections from any device in the local network (192.168.x.x, 10.x.x.x, etc.)
netsh advfirewall firewall add rule name="%FIREWALL_RULE_NAME%" ^
    dir=in ^
    action=allow ^
    protocol=TCP ^
    localport=8080 ^
    profile=Private ^
    description="%FIREWALL_RULE_DESC%"

if %errorLevel% equ 0 (
    echo Firewall rule added successfully (Private network profile)
) else (
    echo WARNING: Failed to add firewall rule. You may need to configure it manually.
    echo Please allow TCP port 8080 in Windows Firewall for private networks.
)

echo.
echo Service installed successfully!
echo.
echo Service Name: %SERVICE_NAME%
echo Display Name: %SERVICE_DISPLAY_NAME%
echo Start Type: Automatic
echo.
echo Configuration: %ProgramData%\ScaleCmdBridge\config\devices.json
echo Logs: %ProgramData%\ScaleCmdBridge\logs\
echo.
echo Network Access:
echo   The service is accessible at http://localhost:8080
echo   For local network access, use your computer's IP address (e.g., http://192.168.1.100:8080)
echo   Firewall rule has been configured for Private network profile
echo.

if %QUIET%==1 (
    echo.
    echo Starting service...
    "%NSSM_EXE%" start "%SERVICE_NAME%"
    timeout /t 2 /nobreak >nul
    sc query "%SERVICE_NAME%"
) else (
    choice /C YN /M "Do you want to start the service now"
    if errorlevel 2 goto :end
    if errorlevel 1 (
        echo.
        echo Starting service...
        "%NSSM_EXE%" start "%SERVICE_NAME%"
        timeout /t 2 /nobreak >nul
        sc query "%SERVICE_NAME%"
    )
)

:end
echo.
echo Installation complete!
echo.
echo To manage the service:
echo   Start:   net start "%SERVICE_NAME%"
echo   Stop:    net stop "%SERVICE_NAME%"
echo   Status:  sc query "%SERVICE_NAME%"
echo.
if %QUIET%==0 pause

