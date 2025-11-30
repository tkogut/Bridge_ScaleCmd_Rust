@echo off
REM Start backend server with MinGW environment
echo Starting ScaleIT Bridge Backend Server...
echo.

REM Set MinGW environment
set MINGW_PATH=D:\msys64\mingw64
set PATH=%MINGW_PATH%\bin;%PATH%
set CC=%MINGW_PATH%\bin\gcc.exe
set CXX=%MINGW_PATH%\bin\g++.exe
set AR=%MINGW_PATH%\bin\ar.exe
set RANLIB=%MINGW_PATH%\bin\ranlib.exe
set CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=%MINGW_PATH%\bin\gcc.exe

REM Set Rust toolchain
rustup default stable-x86_64-pc-windows-gnu

echo Environment configured. Starting server...
echo.

REM Navigate to Rust project and run
cd src-rust
cargo run --release

pause
