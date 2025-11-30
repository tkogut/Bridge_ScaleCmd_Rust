@echo off
REM Test runner script with MinGW toolchain setup for Windows
REM This script sets up MinGW environment and runs all tests

echo ==========================================
echo ScaleIT Bridge Test Suite with MinGW
echo ==========================================
echo.

REM Set MinGW path - using MSYS2 mingw64 environment
set MINGW_PATH=D:\msys64\mingw64

REM Check if MSYS2 MinGW path exists
if not exist "%MINGW_PATH%" (
    echo Error: MSYS2 MinGW path not found: %MINGW_PATH%
    echo Please ensure MSYS2 is installed with MinGW64 environment.
    echo You can install MSYS2 from https://www.msys2.org/
    pause
    exit /b 1
)

REM Setup MSYS2 MinGW environment
echo Setting up MSYS2 MinGW toolchain...
set PATH=%MINGW_PATH%\bin;%PATH%
set RUSTFLAGS=-C target-cpu=native
set CC=%MINGW_PATH%\bin\gcc.exe
set CXX=%MINGW_PATH%\bin\g++.exe
set AR=%MINGW_PATH%\bin\ar.exe
set RANLIB=%MINGW_PATH%\bin\ranlib.exe
set CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=%MINGW_PATH%\bin\gcc.exe

REM Verify MSYS2 MinGW tools
echo Verifying MSYS2 MinGW installation...
"%MINGW_PATH%\bin\gcc.exe" --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: gcc not found or not working
    pause
    exit /b 1
)

"%MINGW_PATH%\bin\dlltool.exe" --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: dlltool not found or not working
    pause
    exit /b 1
)

echo MSYS2 MinGW toolchain verified successfully!
echo.

REM Set Rust toolchain to GNU
echo Setting Rust toolchain to GNU...
rustup toolchain install stable-x86_64-pc-windows-gnu
if %ERRORLEVEL% neq 0 (
    echo Warning: Failed to install GNU toolchain
)

rustup default stable-x86_64-pc-windows-gnu
if %ERRORLEVEL% neq 0 (
    echo Warning: Failed to set GNU toolchain as default
)

echo.
echo Current Rust toolchain:
rustup show

echo.
echo ==========================================
echo Running Rust Backend Tests
echo ==========================================

cd src-rust
if %ERRORLEVEL% neq 0 (
    echo Error: Could not navigate to src-rust directory
    pause
    exit /b 1
)

echo.
echo Building Rust project...
cargo build
if %ERRORLEVEL% neq 0 (
    echo Error: Rust build failed
    cd ..
    pause
    exit /b 1
)

echo.
echo Running Rust unit tests...
cargo test --lib
set RUST_UNIT_RESULT=%ERRORLEVEL%

echo.
echo Running Rust integration tests...
cargo test --test integration_test
set RUST_INTEGRATION_RESULT=%ERRORLEVEL%

echo.
echo Running device adapter tests...
cargo test device_test
set RUST_DEVICE_RESULT=%ERRORLEVEL%

echo.
echo Running API tests...
cargo test api_test
set RUST_API_RESULT=%ERRORLEVEL%

cd ..

echo.
echo ==========================================
echo Running Frontend Tests
echo ==========================================

echo.
echo Installing frontend dependencies...
npm install
if %ERRORLEVEL% neq 0 (
    echo Error: npm install failed
    pause
    exit /b 1
)

echo.
echo Running frontend unit tests...
npm run test:unit
set FRONTEND_UNIT_RESULT=%ERRORLEVEL%

echo.
echo Running frontend component tests...
npm run test:component
set FRONTEND_COMPONENT_RESULT=%ERRORLEVEL%

echo.
echo ==========================================
echo Running End-to-End Tests
echo ==========================================

echo.
echo Installing Playwright browsers...
npx playwright install --with-deps
if %ERRORLEVEL% neq 0 (
    echo Warning: Playwright install failed, E2E tests may not work
)

echo.
echo Starting backend server for E2E tests...
start /B cmd /c "cd src-rust && cargo run --release"

REM Wait for server to start
timeout /t 10 /nobreak

echo.
echo Running E2E tests...
npm run test:e2e
set E2E_RESULT=%ERRORLEVEL%

REM Stop the backend server
taskkill /f /im bridge_scalecmd_rust.exe >nul 2>&1

echo.
echo ==========================================
echo Test Results Summary
echo ==========================================

if %RUST_UNIT_RESULT% equ 0 (
    echo ✓ Rust Unit Tests: PASSED
) else (
    echo ✗ Rust Unit Tests: FAILED
)

if %RUST_INTEGRATION_RESULT% equ 0 (
    echo ✓ Rust Integration Tests: PASSED
) else (
    echo ✗ Rust Integration Tests: FAILED
)

if %RUST_DEVICE_RESULT% equ 0 (
    echo ✓ Rust Device Tests: PASSED
) else (
    echo ✗ Rust Device Tests: FAILED
)

if %RUST_API_RESULT% equ 0 (
    echo ✓ Rust API Tests: PASSED
) else (
    echo ✗ Rust API Tests: FAILED
)

if %FRONTEND_UNIT_RESULT% equ 0 (
    echo ✓ Frontend Unit Tests: PASSED
) else (
    echo ✗ Frontend Unit Tests: FAILED
)

if %FRONTEND_COMPONENT_RESULT% equ 0 (
    echo ✓ Frontend Component Tests: PASSED
) else (
    echo ✗ Frontend Component Tests: FAILED
)

if %E2E_RESULT% equ 0 (
    echo ✓ End-to-End Tests: PASSED
) else (
    echo ✗ End-to-End Tests: FAILED
)

echo.
REM Calculate overall result
set /a TOTAL_FAILURES=%RUST_UNIT_RESULT% + %RUST_INTEGRATION_RESULT% + %RUST_DEVICE_RESULT% + %RUST_API_RESULT% + %FRONTEND_UNIT_RESULT% + %FRONTEND_COMPONENT_RESULT% + %E2E_RESULT%

if %TOTAL_FAILURES% equ 0 (
    echo ==========================================
    echo 🎉 ALL TESTS PASSED! 🎉
    echo ==========================================
    exit /b 0
) else (
    echo ==========================================
    echo ❌ SOME TESTS FAILED ❌
    echo Total failed test suites: %TOTAL_FAILURES%
    echo ==========================================
    pause
    exit /b 1
)
