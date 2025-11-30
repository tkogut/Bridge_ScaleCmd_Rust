@echo off
REM ============================================
REM ScaleIT Bridge - MSYS2 MinGW64 Setup & Build
REM ============================================

setlocal enabledelayedexpansion

REM Konfiguracja ścieżek
set MSYS2_PATH=D:\msys64
set MINGW_PATH=%MSYS2_PATH%\mingw64

REM Sprawdzenie czy MSYS2 istnieje
if not exist "%MSYS2_PATH%" (
    echo.
    echo [ERROR] MSYS2 nie znaleziona w %MSYS2_PATH%
    echo.
    pause
    exit /b 1
)

if not exist "%MINGW_PATH%" (
    echo.
    echo [ERROR] MinGW64 nie znaleziona w %MINGW_PATH%
    echo.
    pause
    exit /b 1
)

REM Czyszczenie ekranu i wyświetlenie nagłówka
cls
echo.
echo ============================================
echo ScaleIT Bridge - MSYS2 MinGW64 Setup
echo ============================================
echo.
echo Sciezka MSYS2: %MSYS2_PATH%
echo Sciezka MinGW64: %MINGW_PATH%
echo.

REM Krok 1: Ustaw zmienne środowiskowe
echo [STEP 1] Konfiguracja zmiennych środowiskowych...
echo.

set "CC=%MINGW_PATH%\bin\gcc.exe"
set "CXX=%MINGW_PATH%\bin\g++.exe"
set "AR=%MINGW_PATH%\bin\ar.exe"
set "RANLIB=%MINGW_PATH%\bin\ranlib.exe"
set "DLLTOOL=%MINGW_PATH%\bin\dlltool.exe"
set "CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=%MINGW_PATH%\bin\gcc.exe"

set "PATH=%MINGW_PATH%\bin;%MSYS2_PATH%\usr\bin;%PATH%"

echo [OK] Zmienne środowiskowe ustawione:
echo   CC=%CC%
echo   AR=%AR%
echo   DLLTOOL=%DLLTOOL%
echo.

REM Krok 2: Weryfikacja narzędzi
echo [STEP 2] Weryfikacja narzedzi MinGW64...
echo.

echo Checking gcc...
"%CC%" --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] gcc nie znaleziony
    pause
    exit /b 1
) else (
    echo [OK] gcc znaleziony
)

echo.
echo Checking dlltool...
"%DLLTOOL%" --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] dlltool nie znaleziony
    pause
    exit /b 1
) else (
    echo [OK] dlltool znaleziony
)

echo.
echo Checking ar...
"%AR%" --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] ar nie znaleziony
    pause
    exit /b 1
) else (
    echo [OK] ar znaleziony
)

echo.
echo [SUCCESS] Wszystkie narzędzia MinGW64 zweryfikowane!
echo.

REM Krok 3: Instalacja i ustawienie Rust toolchaina GNU
echo [STEP 3] Instalacja i konfiguracja Rust toolchaina GNU...
echo.

rustup toolchain install stable-x86_64-pc-windows-gnu
if errorlevel 1 (
    echo [ERROR] Nie udało się zainstalować stable-x86_64-pc-windows-gnu
    pause
    exit /b 1
)

rustup default stable-x86_64-pc-windows-gnu
if errorlevel 1 (
    echo [ERROR] Nie udało się ustawić stable-x86_64-pc-windows-gnu jako domyślnego
    pause
    exit /b 1
) else (
    echo [OK] Rust toolchain zainstalowany i ustawiony na GNU
)

echo.
rustup show | findstr "active"
echo.

REM Krok 4: Czyszczenie poprzedniej kompilacji
echo [STEP 4] Czyszczenie poprzedniej kompilacji...
echo.

cd /d "%~dp0src-rust"
cargo clean >nul 2>&1

echo [OK] Poczyszczono
echo.

REM Krok 5: Kompilacja w trybie release
echo [STEP 5] Kompilacja cargo build --release...
echo.

cargo build --release
if errorlevel 1 (
    echo.
    echo ============================================
    echo [ERROR] Kompilacja nie powiodła się!
    echo ============================================
    echo.
    pause
    exit /b 1
)

echo.

REM Krok 6: Weryfikacja binaria
echo [STEP 6] Weryfikacja wynikowego binaria...
echo.

set BINARY=%~dp0src-rust\target\release\scaleit-bridge.exe

if not exist "%BINARY%" (
    echo [ERROR] Binaria nie znaleziona: %BINARY%
    pause
    exit /b 1
) else (
    echo [OK] Binaria znaleziona: %BINARY%
)

echo.

REM Sukces
echo ============================================
echo [SUCCESS] Kompilacja ukończona!
echo ============================================
echo.
echo Binaria dostępne w:
echo   %BINARY%
echo.
echo Uruchom aplikację:
echo   cd src-rust\target\release
echo   .\scaleit-bridge.exe
echo.
echo Lub z głównego folderu:
echo   .\src-rust\target\release\scaleit-bridge.exe --config .\config\devices.json
echo.
pause
endlocal
