@echo off
REM ScaleCmdBridge - Stop Windows Service

setlocal

set "SERVICE_NAME=ScaleCmdBridge"

echo Stopping %SERVICE_NAME% service...
net stop "%SERVICE_NAME%"

if %errorLevel% equ 0 (
    echo.
    echo Service stopped successfully!
) else (
    echo.
    echo ERROR: Failed to stop service
    echo Service may not be running or may require administrator privileges
)

echo.
pause

