@echo off
REM Setup MinGW toolchain for Rust compilation on Windows
REM This script configures the environment to use MinGW instead of MSVC

echo Setting up MinGW toolchain for Rust...

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

REM Add MinGW to PATH
set PATH=%MINGW_PATH%\bin;%PATH%

REM Set Rust environment variables for GNU toolchain
set RUSTFLAGS=-C target-cpu=native
set CC=%MINGW_PATH%\bin\gcc.exe
set CXX=%MINGW_PATH%\bin\g++.exe
set AR=%MINGW_PATH%\bin\ar.exe
set RANLIB=%MINGW_PATH%\bin\ranlib.exe

REM Configure Cargo to use GNU linker
set CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=%MINGW_PATH%\bin\gcc.exe

echo MSYS2 MinGW toolchain configured successfully!
echo.
echo Environment variables set:
echo   MINGW_PATH=%MINGW_PATH%
echo   CC=%CC%
echo   CXX=%CXX%
echo   AR=%AR%
echo   RANLIB=%RANLIB%
echo   CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=%CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER%
echo.
echo Verifying MSYS2 MinGW installation...

REM Verify tools are available
echo Checking gcc...
"%MINGW_PATH%\bin\gcc.exe" --version
if %ERRORLEVEL% neq 0 (
    echo Error: gcc not found or not working
    pause
    exit /b 1
)

echo.
echo Checking dlltool...
"%MINGW_PATH%\bin\dlltool.exe" --version
if %ERRORLEVEL% neq 0 (
    echo Error: dlltool not found or not working
    pause
    exit /b 1
)

echo.
echo Checking ar...
"%MINGW_PATH%\bin\ar.exe" --version
if %ERRORLEVEL% neq 0 (
    echo Error: ar not found or not working
    pause
    exit /b 1
)

echo.
echo All MSYS2 MinGW tools verified successfully!
echo.
echo Setting Rust toolchain to GNU...
rustup toolchain install stable-x86_64-pc-windows-gnu
rustup default stable-x86_64-pc-windows-gnu

echo.
echo MSYS2 MinGW setup complete! You can now build the Rust project.
echo Run: cargo build --release
echo.
echo Note: This script uses your MSYS2 installation at D:\msys64
echo If you need to update the path, modify the MINGW_PATH variable in this script.
