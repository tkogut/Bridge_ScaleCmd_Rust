@echo off
REM ScaleIT Bridge Build Setup Script for Windows
REM This script sets up the build environment and compiles the project

setlocal enabledelayedexpansion

cls
echo.
echo ========================================
echo ScaleIT Bridge - Build Setup for Windows
echo ========================================
echo.

set SCRIPT_DIR=%~dp0
set BUILD_LOG=%SCRIPT_DIR%build.log

echo Logging output to: %BUILD_LOG%
echo.

REM Check for MSVC compiler
echo [1/5] Checking for MSVC compiler...
where cl.exe >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: MSVC compiler (cl.exe) not found.
    echo.
    echo Please install Visual Studio Build Tools:
    echo 1. Download from: https://visualstudio.microsoft.com/downloads/
    echo 2. Select "Build Tools for Visual Studio 2022"
    echo 3. Include "Desktop development with C++" workload
    echo.
    echo After installation, run this script from the Developer PowerShell:
    echo   Search for "Developer PowerShell" in Windows Start Menu
    echo.
    pause
    exit /b 1
)
echo  - MSVC compiler found: OK >> %BUILD_LOG%
echo  - MSVC compiler found: OK

REM Check for Rust
echo.
echo [2/5] Checking Rust toolchain...
where cargo >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Rust (cargo) not found.
    echo.
    echo Please install Rust:
    echo 1. Download from: https://rustup.rs/
    echo 2. Run the installer and follow the prompts
    echo 3. Close and reopen the terminal
    echo.
    pause
    exit /b 1
)

cargo --version >> %BUILD_LOG% 2>&1
echo  - Rust installed >> %BUILD_LOG%
echo  - Rust installed
cargo --version

REM Set MSVC as default
echo.
echo [3/5] Configuring Rust for MSVC...
rustup default stable-x86_64-pc-windows-msvc >> %BUILD_LOG% 2>&1
echo  - Rust default set to MSVC >> %BUILD_LOG%
echo  - Rust default set to MSVC

REM Build backend
echo.
echo [4/5] Building backend (this may take 5-10 minutes)...
cd /d "%SCRIPT_DIR%src-rust"
cargo build --release >> %BUILD_LOG% 2>&1

if %errorLevel% neq 0 (
    echo ERROR: Build failed!
    echo.
    echo See build log: %BUILD_LOG%
    echo.
    echo Common issues:
    echo  - Missing MSVC: Run from "Developer PowerShell"
    echo  - Missing dependencies: cargo update
    echo.
    type %BUILD_LOG% | findstr /i "error" | more
    pause
    exit /b 1
)
echo  - Backend build successful >> %BUILD_LOG%
echo  - Backend build successful

REM Build frontend
echo.
echo [5/5] Building frontend...
cd /d "%SCRIPT_DIR%"

if exist "package.json" (
    if not exist "node_modules" (
        echo Installing npm dependencies...
        call npm install >> %BUILD_LOG% 2>&1
        if %errorLevel% neq 0 (
            echo WARNING: npm install failed
            echo Some frontend dependencies may be missing
        )
    )
    
    echo Building React frontend...
    call npm run build >> %BUILD_LOG% 2>&1
    
    if %errorLevel% neq 0 (
        echo WARNING: Frontend build failed
        echo Check %BUILD_LOG% for details
    ) else (
        echo  - Frontend build successful >> %BUILD_LOG%
        echo  - Frontend build successful
    )
) else (
    echo  - Frontend build skipped (no package.json) >> %BUILD_LOG%
    echo  - Frontend build skipped (no package.json)
)

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
echo Binaries:
echo  - Backend: %SCRIPT_DIR%src-rust\target\release\scaleit-bridge.exe
if exist "dist" echo  - Frontend: %SCRIPT_DIR%dist\
echo.
echo Next Steps:
echo  1. Review config: %SCRIPT_DIR%src-rust\config\devices.json
echo  2. Create installer package (see BUILD_WINDOWS.md)
echo  3. Run INSTALL.bat on target machine
echo.
echo For detailed build log, see: %BUILD_LOG%
echo.
pause
