@echo off
REM ScaleIT Bridge - Run Tests with MinGW Environment
REM This script sets up MinGW environment and runs all Rust tests

setlocal enabledelayedexpansion

echo.
echo ========================================
echo ScaleIT Bridge - Running Tests
echo ========================================
echo.

REM Check if PowerShell is available
where powershell.exe >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: PowerShell not found. Please install PowerShell.
    pause
    exit /b 1
)

echo Setting up MinGW environment and running tests...
echo.

REM Run tests using PowerShell script with MinGW setup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "test-rust-mingw.ps1"

if %errorLevel% equ 0 (
    echo.
    echo ========================================
    echo All tests passed successfully!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Some tests failed. Check output above.
    echo ========================================
)

echo.
pause

