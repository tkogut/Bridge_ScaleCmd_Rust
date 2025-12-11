@echo off
REM ScaleCmdBridge - Start Windows Service

setlocal

set "SERVICE_NAME=ScaleCmdBridge"

echo Starting %SERVICE_NAME% service...
net start "%SERVICE_NAME%"

if %errorLevel% equ 0 (
    echo.
    echo Service started successfully!
    echo.
    sc query "%SERVICE_NAME%"
) else (
    echo.
    echo ERROR: Failed to start service
    echo Check Windows Event Viewer for details
)

echo.
pause

