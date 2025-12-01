@echo off
REM ============================================
REM ScaleIT Bridge - Setup MSVC Toolchain + MinGW Linker & Build
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

cls
echo.
echo ============================================
echo ScaleIT Bridge - MSVC toolchain + MinGW linker setup
echo ============================================
echo.
echo MSYS2 Path: %MSYS2_PATH%
echo MinGW64 Path: %MINGW_PATH%
echo.

REM Krok 1: Ustaw zmienne srodowiskowe i PATH
echo [STEP 1] Konfiguracja zmiennych srodowiskowych...
echo.

set "PATH=%MINGW_PATH%\x86_64-w64-mingw32\bin;%MINGW_PATH%\bin;%MSYS2_PATH%\usr\bin;%PATH%"
set "CC=%MINGW_PATH%\bin\gcc.exe"
set "AR=%MINGW_PATH%\bin\ar.exe"
set "DLLTOOL=%MINGW_PATH%\x86_64-w64-mingw32\bin\dlltool.exe"

echo [OK] Zmienne srodowiskowe ustawione:
echo   CC=%CC%
echo   AR=%AR%
echo   DLLTOOL=%DLLTOOL%
echo.

REM Krok 2: Weryfikacja narzedzi
echo [STEP 2] Weryfikacja narzedzi MinGW64...
echo.

"%CC%" --version >nul 2>&1 && echo [OK] gcc znaleziony || (echo [ERROR] gcc nie znaleziony & pause & exit /b 1)
"%DLLTOOL%" --version >nul 2>&1 && echo [OK] dlltool znaleziony || (echo [ERROR] dlltool nie znaleziony & pause & exit /b 1)
"%AR%" --version >nul 2>&1 && echo [OK] ar znaleziony || (echo [ERROR] ar nie znaleziony & pause & exit /b 1)

echo.
echo [SUCCESS] Wszystkie narzedzia MinGW64 zweryfikowane!
echo.

REM Krok 3: Instalacja i ustawienie Rust toolchaina MSVC
echo [STEP 3] Instalacja i konfiguracja Rust toolchaina MSVC...
echo.

rustup install stable-x86_64-pc-windows-msvc
rustup default stable-x86_64-pc-windows-msvc

if errorlevel 1 (
    echo [ERROR] Nie udalo sie ustawic Rust toolchaina
    pause
    exit /b 1
)

echo.
rustup show | findstr "active"
echo.

REM Krok 4: Utwórz plik .cargo/config.toml - POPRAWNA METODA
echo [STEP 4] Tworzenie .cargo\config.toml z konfiguracją linkera MinGW...

set CARGO_CONFIG_DIR=%~dp0src-rust\.cargo
set CARGO_CONFIG_FILE=%CARGO_CONFIG_DIR%\config.toml

if not exist "%CARGO_CONFIG_DIR%" (
    mkdir "%CARGO_CONFIG_DIR%"
)

REM Konwertuj backslash na forward slash dla ścieżki do TOML
setlocal enabledelayedexpansion
set "MINGW_PATH_FORWARD=!MINGW_PATH:\=/!"

(
echo [target.x86_64-pc-windows-msvc]
echo linker = "!MINGW_PATH_FORWARD!/bin/gcc.exe"
echo ar = "!MINGW_PATH_FORWARD!/bin/ar.exe"
) > "%CARGO_CONFIG_FILE%"

echo [OK] Wygenerowano "%CARGO_CONFIG_FILE%"
echo.

REM Krok 5: Czyszczenie projektu
echo [STEP 5] Czyszczenie poprzedniej kompilacji...
echo.

cd /d "%~dp0src-rust"
cargo clean >nul 2>&1

echo [OK] Poczyszczono
echo.

REM Krok 6: Kompilacja release
echo [STEP 6] Kompilacja cargo build --release...
echo.

cargo build --release

if errorlevel 1 (
    echo.
    echo ============================================
    echo [ERROR] Kompilacja nie powiodla sie!
    echo ============================================
    echo.
    pause
    exit /b 1
)

echo.

REM Krok 7: Weryfikacja binaria
echo [STEP 7] Weryfikacja wynikowego binaria...
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
echo [SUCCESS] Kompilacja ukonczona!
echo ============================================
echo.
echo Binaria dostepne w:
echo   %BINARY%
echo.
echo Uruchom aplikacje:
echo   cd src-rust\target\release
echo   .\scaleit-bridge.exe
echo.
echo Lub z glownego folderu:
echo   .\src-rust\target\release\scaleit-bridge.exe --config .\config\devices.json
echo.
pause
endlocal
