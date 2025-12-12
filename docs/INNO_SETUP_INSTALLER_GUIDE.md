# Instrukcja przygotowania instalatora Windows Service - Inno Setup

Kompletny przewodnik krok po kroku jak przygotować plik instalacyjny `ScaleCmdBridge-Setup-x64.exe` przy użyciu Inno Setup.

## 📋 Wymagania wstępne

### 1. Oprogramowanie wymagane

- **Inno Setup 6** (lub nowszy)
  - Download: https://jrsoftware.org/isdl.php
  - Instalacja: Standardowa instalacja Windows
  - Lokalizacja: `C:\Program Files (x86)\Inno Setup 6\` (domyślnie)
  - Kompilator: `ISCC.exe` (command-line) lub `Compil32.exe` (GUI)

- **Rust** (z MinGW toolchain)
  - Toolchain: `stable-x86_64-pc-windows-gnu`
  - Sprawdź: `rustup show`

- **Node.js i npm**
  - Wersja: 18+ (zalecane)
  - Sprawdź: `node --version` i `npm --version`

- **PowerShell 5.1+**
  - Zazwyczaj preinstalowany w Windows 10/11

### 2. Struktura projektu

Upewnij się, że masz następującą strukturę:

```
Bridge_ScaleCmd_Rust/
├── src-rust/              # Backend Rust
├── dist/                  # Frontend (po npm run build)
├── installer/
│   ├── ScaleCmdBridge.iss # Skrypt Inno Setup
│   └── nssm/
│       └── nssm.exe       # NSSM executable (64-bit)
├── scripts/
│   └── Build-WindowsInstaller.ps1
├── INSTALL-SERVICE.bat
├── UNINSTALL-SERVICE.bat
├── START-SERVICE.bat
└── STOP-SERVICE.bat
```

## 🚀 Metoda 1: Automatyczna (Zalecana)

Użyj skryptu PowerShell, który automatyzuje cały proces:

### Krok 1: Przygotowanie środowiska

```powershell
# Przejdź do katalogu projektu
cd C:\Users\tkogut\.cursor\Bridge_ScaleCmd_Rust

# Sprawdź czy wszystkie wymagania są spełnione
Write-Host "Sprawdzanie wymagań..." -ForegroundColor Cyan

# 1. Inno Setup (sprawdź oba kompilatory)
$iscc = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
$compil32 = "C:\Program Files (x86)\Inno Setup 6\Compil32.exe"
if (Test-Path $iscc) {
    Write-Host "✅ Inno Setup (ISCC.exe): OK" -ForegroundColor Green
} elseif (Test-Path $compil32) {
    Write-Host "✅ Inno Setup (Compil32.exe): OK" -ForegroundColor Green
} else {
    Write-Host "❌ Inno Setup: BRAK - zainstaluj z https://jrsoftware.org/isdl.php" -ForegroundColor Red
    exit 1
}

# 2. Rust
if (Get-Command rustc -ErrorAction SilentlyContinue) {
    Write-Host "✅ Rust: OK" -ForegroundColor Green
} else {
    Write-Host "❌ Rust: BRAK - zainstaluj z https://rustup.rs/" -ForegroundColor Red
    exit 1
}

# 3. Node.js
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "✅ Node.js: OK" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js: BRAK - zainstaluj z https://nodejs.org/" -ForegroundColor Red
    exit 1
}
```

### Krok 2: Uruchomienie automatycznego builda

```powershell
# Uruchom skrypt build pipeline
.\scripts\Build-WindowsInstaller.ps1
```

**Co robi skrypt:**
1. ✅ Buduje Rust backend (release)
2. ✅ Buduje React frontend (production)
3. ✅ Pobiera NSSM automatycznie (jeśli brakuje)
4. ✅ Kompiluje Inno Setup installer
5. ✅ Tworzy `release\ScaleCmdBridge-Setup-x64.exe`

**Parametry opcjonalne:**
```powershell
# Pomiń budowanie backendu (jeśli już zbudowany)
.\scripts\Build-WindowsInstaller.ps1 -SkipBackend

# Pomiń budowanie frontendu (jeśli już zbudowany)
.\scripts\Build-WindowsInstaller.ps1 -SkipFrontend

# Pomiń pobieranie NSSM (jeśli już jest)
.\scripts\Build-WindowsInstaller.ps1 -SkipNSSM

# Pomiń kompilację instalatora (tylko przygotuj pliki)
.\scripts\Build-WindowsInstaller.ps1 -SkipInstaller

# Wszystko razem (szybki rebuild)
.\scripts\Build-WindowsInstaller.ps1 -SkipBackend -SkipFrontend -SkipNSSM
```

### Krok 3: Weryfikacja

```powershell
# Sprawdź czy instalator został utworzony
if (Test-Path "release\ScaleCmdBridge-Setup-x64.exe") {
    $file = Get-Item "release\ScaleCmdBridge-Setup-x64.exe"
    Write-Host "✅ Instalator utworzony!" -ForegroundColor Green
    Write-Host "   Lokalizacja: $($file.FullName)" -ForegroundColor Cyan
    Write-Host "   Rozmiar: $([math]::Round($file.Length / 1MB, 2)) MB" -ForegroundColor Cyan
    Write-Host "   Data: $($file.CreationTime)" -ForegroundColor Gray
} else {
    Write-Host "❌ Instalator nie został utworzony!" -ForegroundColor Red
}
```

## 🔧 Metoda 2: Ręczna (Dla zaawansowanych)

Jeśli chcesz mieć pełną kontrolę nad procesem:

### Krok 1: Zbuduj backend (Rust)

```powershell
# Z katalogu projektu
.\build-rust-mingw.ps1 --release

# Sprawdź wynik
$exePath = "src-rust\target\release\scaleit-bridge.exe"
if (Test-Path $exePath) {
    Write-Host "✅ Backend zbudowany: $exePath" -ForegroundColor Green
} else {
    Write-Host "❌ Backend nie został zbudowany!" -ForegroundColor Red
    exit 1
}
```

### Krok 2: Zbuduj frontend (React)

```powershell
# Z katalogu projektu
npm install
npm run build

# Sprawdź wynik
if (Test-Path "dist\index.html") {
    Write-Host "✅ Frontend zbudowany: dist/" -ForegroundColor Green
} else {
    Write-Host "❌ Frontend nie został zbudowany!" -ForegroundColor Red
    exit 1
}
```

### Krok 3: Przygotuj NSSM

```powershell
# Sprawdź czy NSSM istnieje
$nssmPath = "installer\nssm\nssm.exe"
if (Test-Path $nssmPath) {
    Write-Host "✅ NSSM już istnieje" -ForegroundColor Green
} else {
    Write-Host "Pobieranie NSSM..." -ForegroundColor Yellow
    
    # Utwórz katalog
    New-Item -ItemType Directory -Path "installer\nssm" -Force | Out-Null
    
    # Pobierz NSSM
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $nssmZip = "$env:TEMP\nssm-2.24.zip"
    
    Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip -UseBasicParsing
    Expand-Archive -Path $nssmZip -DestinationPath $env:TEMP -Force
    
    # Skopiuj 64-bit wersję
    $nssmSource = "$env:TEMP\nssm-2.24\win64\nssm.exe"
    Copy-Item $nssmSource $nssmPath -Force
    
    # Wyczyść
    Remove-Item $nssmZip -ErrorAction SilentlyContinue
    Remove-Item "$env:TEMP\nssm-2.24" -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-Host "✅ NSSM pobrany" -ForegroundColor Green
}
```

### Krok 4: Sprawdź skrypt Inno Setup

```powershell
# Sprawdź czy plik .iss istnieje
$issFile = "installer\ScaleCmdBridge.iss"
if (Test-Path $issFile) {
    Write-Host "✅ Skrypt Inno Setup: $issFile" -ForegroundColor Green
} else {
    Write-Host "❌ Skrypt Inno Setup nie znaleziony!" -ForegroundColor Red
    exit 1
}
```

### Krok 5: Skompiluj instalator

**Opcja A: Przez Inno Setup Compiler GUI**

1. Otwórz Inno Setup Compiler
2. File → Open → wybierz `installer\ScaleCmdBridge.iss`
3. Build → Compile (lub F9)
4. Instalator zostanie utworzony w `release\ScaleCmdBridge-Setup-x64.exe`

**Opcja B: Przez wiersz poleceń**

```powershell
# Znajdź kompilator (ISCC.exe lub Compil32.exe)
$iscc = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
$compil32 = "C:\Program Files (x86)\Inno Setup 6\Compil32.exe"

if (Test-Path $iscc) {
    $compiler = $iscc
} elseif (Test-Path $compil32) {
    $compiler = $compil32
} else {
    Write-Host "Inno Setup Compiler nie znaleziony!" -ForegroundColor Red
    exit 1
}

# Skompiluj
& $compiler "installer\ScaleCmdBridge.iss"

# Sprawdź wynik
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Instalator skompilowany pomyślnie!" -ForegroundColor Green
} else {
    Write-Host "❌ Błąd kompilacji instalatora!" -ForegroundColor Red
    exit 1
}
```

## 📝 Konfiguracja instalatora

### Edycja wersji

W pliku `installer\ScaleCmdBridge.iss`:

```iss
#define MyAppVersion "1.0.0"  // Zmień na aktualną wersję
```

### Edycja ścieżek

Upewnij się, że ścieżki w `[Files]` sekcji są poprawne:

```iss
[Files]
; Backend executable
Source: "..\src-rust\target\release\scaleit-bridge.exe"; DestDir: "{app}"; DestName: "{#MyAppExeName}"; Flags: ignoreversion
; NSSM
Source: "..\installer\nssm\nssm.exe"; DestDir: "{app}"; Flags: ignoreversion
; Frontend
Source: "..\dist\*"; DestDir: "{app}\web"; Flags: ignoreversion recursesubdirs createallsubdirs
```

### Edycja portu domyślnego

W sekcji `[Code]`:

```iss
procedure InitializeWizard();
begin
  PortPage.Values[0] := '8080';  // Zmień domyślny port tutaj
end;
```

## ✅ Weryfikacja instalatora

### Sprawdź zawartość

```powershell
# Sprawdź rozmiar
$installer = Get-Item "release\ScaleCmdBridge-Setup-x64.exe"
Write-Host "Rozmiar: $([math]::Round($installer.Length / 1MB, 2)) MB" -ForegroundColor Cyan

# Oczekiwany rozmiar: ~5-10 MB (zależy od zawartości)
```

### Test instalacji (opcjonalnie)

**UWAGA:** Testuj tylko na maszynie testowej lub VM!

```powershell
# Uruchom instalator (jako Administrator)
Start-Process -FilePath "release\ScaleCmdBridge-Setup-x64.exe" -Verb RunAs

# Po instalacji sprawdź:
sc query ScaleCmdBridge
```

## 🐛 Rozwiązywanie problemów

### Problem: "Inno Setup Compiler not found"

**Rozwiązanie:**
```powershell
# Sprawdź lokalizację (oba kompilatory)
Get-ChildItem "C:\Program Files*" -Recurse -Filter "ISCC.exe" -ErrorAction SilentlyContinue
Get-ChildItem "C:\Program Files*" -Recurse -Filter "Compil32.exe" -ErrorAction SilentlyContinue

# Sprawdź standardową lokalizację
Test-Path "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
Test-Path "C:\Program Files (x86)\Inno Setup 6\Compil32.exe"

# Lub zainstaluj Inno Setup:
# https://jrsoftware.org/isdl.php
```

### Problem: "Backend executable not found"

**Rozwiązanie:**
```powershell
# Zbuduj backend
.\build-rust-mingw.ps1 --release

# Sprawdź ścieżkę w ScaleCmdBridge.iss
# Powinno być: ..\src-rust\target\release\scaleit-bridge.exe
```

### Problem: "Frontend build output not found"

**Rozwiązanie:**
```powershell
# Zbuduj frontend
npm run build

# Sprawdź czy dist/index.html istnieje
Test-Path "dist\index.html"
```

### Problem: "NSSM not found"

**Rozwiązanie:**
```powershell
# Skrypt automatycznie pobiera NSSM, ale możesz też ręcznie:
# 1. Pobierz z: https://nssm.cc/download
# 2. Rozpakuj
# 3. Skopiuj win64\nssm.exe do installer\nssm\nssm.exe
```

### Problem: Błędy kompilacji Inno Setup

**Typowe błędy:**

1. **"Unknown identifier 'TryStrToInt'"**
   - ✅ Naprawione: Użyj `StrToIntDef` zamiast `TryStrToInt`

2. **"Unknown identifier 'GetFileSize'"**
   - ✅ Naprawione: Użyj `LoadStringFromFile` z `AnsiString`

3. **"Function not defined before use"**
   - ✅ Naprawione: Funkcje przeniesione przed użyciem

4. **"Source file does not exist"**
   - Sprawdź ścieżki w sekcji `[Files]`
   - Upewnij się, że wszystkie pliki są zbudowane

## 📦 Struktura instalatora

Po kompilacji instalator zawiera:

```
ScaleCmdBridge-Setup-x64.exe
├── ScaleCmdBridge.exe (scaleit-bridge.exe)
├── nssm.exe
├── web/ (frontend dist/)
│   ├── index.html
│   └── assets/
├── INSTALL-SERVICE.bat
├── UNINSTALL-SERVICE.bat
├── START-SERVICE.bat
├── STOP-SERVICE.bat
└── README.md
```

## 🎯 Checklist przed dystrybucją

- [ ] Backend zbudowany (release)
- [ ] Frontend zbudowany (production)
- [ ] NSSM obecny w `installer/nssm/`
- [ ] Wersja zaktualizowana w `ScaleCmdBridge.iss`
- [ ] Instalator skompilowany bez błędów
- [ ] Instalator przetestowany na czystym systemie (opcjonalnie)
- [ ] Rozmiar instalatora rozsądny (~5-10 MB)
- [ ] Dokumentacja zaktualizowana

## 📚 Dodatkowe zasoby

- **Inno Setup Documentation:** https://jrsoftware.org/ishelp/
- **NSSM Documentation:** https://nssm.cc/usage
- **Build Script:** `scripts/Build-WindowsInstaller.ps1`
- **Installer Script:** `installer/ScaleCmdBridge.iss`

## 🚀 Szybki start

```powershell
# Najszybszy sposób - wszystko automatycznie:
.\scripts\Build-WindowsInstaller.ps1

# Instalator będzie w:
# release\ScaleCmdBridge-Setup-x64.exe
```

---

**Ostatnia aktualizacja:** 2025-12-12  
**Wersja:** 1.0.0

