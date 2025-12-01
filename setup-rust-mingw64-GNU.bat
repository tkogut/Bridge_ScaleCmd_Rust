@echo off
REM ============================================
REM ScaleIT Bridge - GNU Toolchain MinGW64 Setup + Build
REM ============================================

setlocal enabledelayedexpansion

REM Konfiguracja ścieżek
set MSYS2_PATH=D:\msys64
set MINGW_PATH=%MSYS2_PATH%\mingw64
set RUSTUP_HOME=%USERPROFILE%\.rustup

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
echo ScaleIT Bridge - GNU Toolchain MinGW64 Setup
echo ============================================
echo.
echo MSYS2 Path: %MSYS2_PATH%
echo MinGW64 Path: %MINGW_PATH%
echo Rustup Home: %RUSTUP_HOME%
echo.

REM Krok 1: Ustaw zmienne srodowiskowe dla GNU
echo [STEP 1] Konfiguracja zmiennych srodowiskowych dla GNU...
echo.

set "PATH=%MINGW_PATH%\x86_64-w64-mingw32\bin;%MINGW_PATH%\bin;%MSYS2_PATH%\usr\bin;%PATH%"
set "CC=%MINGW_PATH%\bin\gcc.exe"
set "CXX=%MINGW_PATH%\bin\g++.exe"
set "AR=%MINGW_PATH%\bin\ar.exe"
set "RANLIB=%MINGW_PATH%\bin\ranlib.exe"
set "LDFLAGS=-L%MINGW_PATH%\lib"
set "CFLAGS=-I%MINGW_PATH%\include"

echo [OK] Zmienne srodowiskowe ustawione dla GNU:
echo   CC=%CC%
echo   AR=%AR%
echo.

REM Krok 2: Weryfikacja narzedzi
echo [STEP 2] Weryfikacja narzedzi MinGW64...
echo.

"%CC%" --version >nul 2>&1 && echo [OK] gcc znaleziony || (echo [ERROR] gcc nie znaleziony & pause & exit /b 1)
"%AR%" --version >nul 2>&1 && echo [OK] ar znaleziony || (echo [ERROR] ar nie znaleziony & pause & exit /b 1)

echo.
echo [SUCCESS] Wszystkie kluczowe narzedzia MinGW64 zweryfikowane!
echo.

REM Krok 3: Instalacja Rust GNU toolchaina
echo [STEP 3] Instalacja Rust GNU toolchaina (x86_64-pc-windows-gnu)...
echo.

rustup install stable-x86_64-pc-windows-gnu
if errorlevel 1 (
    echo [ERROR] Nie udalo sie zainstalowac stable-x86_64-pc-windows-gnu
    pause
    exit /b 1
)

echo [OK] Rust GNU toolchain zainstalowany
echo.

REM Krok 4: Skopiuj cargo z MSVC do GNU
echo [STEP 4] Kopiowanie cargo.exe z MSVC do GNU toolchaina...
echo.

set MSVC_BIN=%RUSTUP_HOME%\toolchains\stable-x86_64-pc-windows-msvc\bin
set GNU_BIN=%RUSTUP_HOME%\toolchains\stable-x86_64-pc-windows-gnu\bin

if not exist "%MSVC_BIN%" (
    echo [WARNING] MSVC toolchain nie znaleziony w %MSVC_BIN%
    echo Instaluję MSVC toolchain...
    rustup install stable-x86_64-pc-windows-msvc
)

REM Skopiuj cargo z MSVC do GNU
if exist "%MSVC_BIN%" (
    echo Kopiuję z: %MSVC_BIN%
    echo Do: %GNU_BIN%

    if not exist "%GNU_BIN%" (
        mkdir "%GNU_BIN%"
    )

    for %%F in ("%MSVC_BIN%\cargo.exe" "%MSVC_BIN%\rustfmt.exe" "%MSVC_BIN%\clippy-driver.exe") do (
        if exist "%%F" (
            copy "%%F" "%GNU_BIN%\" /Y >nul 2>&1
        )
    )

    echo [OK] Cargo i narzedzia zostały skopiowane
) else (
    echo [ERROR] Nie mogę znaleźć MSVC bin folder
    pause
    exit /b 1
)

echo.

REM Krok 5: Ustaw GNU jako domyślny
echo [STEP 5] Ustawianie GNU jako domyslnego toolchaina...
echo.

rustup default stable-x86_64-pc-windows-gnu
if errorlevel 1 (
    echo [ERROR] Nie udalo sie ustawic GNU jako domyslnego
    pause
    exit /b 1
)

echo [OK] Rust GNU toolchain ustawiony jako domyslny
echo.
rustup show | findstr "active"
echo.

REM Krok 6: Usun stary config.toml jezeli istnieje
echo [STEP 6] Czyszczenie starej konfiguracji...

set CARGO_CONFIG_FILE=%~dp0src-rust\.cargo\config.toml
if exist "%CARGO_CONFIG_FILE%" (
    del "%CARGO_CONFIG_FILE%"
    echo [OK] Usuniety stary config.toml
)
echo.

REM Krok 7: Czyszczenie projektu
echo [STEP 7] Czyszczenie poprzedniej kompilacji...
echo.

cd /d "%~dp0src-rust"
cargo clean >nul 2>&1

echo [OK] Poczyszczono
echo.

REM Krok 8: Kompilacja release
echo [STEP 8] Kompilacja cargo build --release (GNU toolchain)...
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

REM Krok 9: Weryfikacja binaria
echo [STEP 9] Weryfikacja wynikowego binaria...
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
pause
endlocal
