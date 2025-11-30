@echo off
echo Setting up MinGW environment for Rust build...

REM Set MinGW path
set MINGW_PATH=D:\msys64\mingw64

REM Add MinGW to PATH
set PATH=%MINGW_PATH%\bin;%PATH%

REM Set environment variables for building
set CC=%MINGW_PATH%\bin\gcc.exe
set CXX=%MINGW_PATH%\bin\g++.exe
set AR=%MINGW_PATH%\bin\ar.exe
set RANLIB=%MINGW_PATH%\bin\ranlib.exe
set CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=%MINGW_PATH%\bin\gcc.exe

echo MinGW environment configured
echo PATH includes: %MINGW_PATH%\bin
echo.

REM Ensure GNU toolchain is active
echo Setting Rust toolchain to GNU...
rustup default stable-x86_64-pc-windows-gnu

echo.
echo Building Rust project...
cd src-rust

REM Clean first to avoid any permission issues
cargo clean

REM Build the project
cargo build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build successful! Running tests...
    cargo test

    if %ERRORLEVEL% EQU 0 (
        echo.
        echo All tests passed! You can now run the server with:
        echo   cargo run
        echo.
        echo Or build a release version with:
        echo   cargo build --release
    ) else (
        echo.
        echo Tests failed. Please check the output above.
    )
) else (
    echo.
    echo Build failed. Please check the output above.
)

pause
