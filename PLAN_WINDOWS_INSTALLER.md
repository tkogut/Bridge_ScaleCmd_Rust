# Plan implementacji Windows Installer + Windows Service

**Branch:** `feature/windows-installer-service`  
**Data rozpoczęcia:** 2025-01-11  
**Status:** W trakcie

---

## 🎯 Cel

Stworzenie kompletnego, produkcyjnego rozwiązania Windows installer + Windows Service dla ScaleCmdBridge, tak aby:
- Użytkownik pobiera jeden plik instalacyjny (ScaleCmdBridge-Setup-x64.exe)
- Po instalacji automatycznie tworzy się i uruchamia Windows Service
- Frontend dostępny jako aplikacja webowa pod http://localhost:8080
- Automatyczne uruchamianie przy starcie Windows
- Konfiguracja firewall, logi, skróty

---

## 📋 Zadania

### ✅ Faza 1: Backend - Statyczne pliki frontendu
- [x] Analiza wymagań
- [x] Dodać `actix-files` do `Cargo.toml`
- [x] Dodać serwowanie statycznych plików z `dist/` pod `/`
- [x] Zachować API pod `/api/*`, `/health`, `/devices`, `/scalecmd`
- [x] Dodać obsługę SPA routing (fallback do index.html przez default_handler)
- [ ] Przetestować lokalnie (frontend dostępny przez backend na http://localhost:8080)

### ✅ Faza 2: Struktura katalogów i konfiguracja
- [x] Zaprojektować strukturę katalogów:
  - `C:\Program Files\ScaleCmdBridge\` - binarki, nssm.exe, web/
  - `C:\ProgramData\ScaleCmdBridge\` - config/, logs/
- [x] Dodać auto-detekcję ścieżek (ProgramData dla config, ProgramFiles dla web)
- [x] Zaktualizować `main.rs` do używania ścieżek z ProgramData/ProgramFiles
- [x] Dodać tworzenie katalogu logs w ProgramData
- [ ] Dodać obsługę logów do pliku (wymaga dodatkowej biblioteki)

### ✅ Faza 3: Windows Service (NSSM)
- [x] Stworzyć `INSTALL-SERVICE.bat` - instalacja usługi przez NSSM
- [x] Stworzyć `UNINSTALL-SERVICE.bat` - odinstalowanie usługi
- [x] Stworzyć `START-SERVICE.bat` / `STOP-SERVICE.bat` - zarządzanie
- [x] Skonfigurować NSSM:
  - AppDirectory: `C:\Program Files\ScaleCmdBridge\`
  - StartType: SERVICE_AUTO_START
  - Logowanie do pliku (stdout/stderr)
  - Rotacja logów (dziennie, 10MB max)
- [ ] Pobrać NSSM (nssm.exe) - dodać do repo lub pobierać podczas builda
- [ ] Dodać EventLog support (wymaga dodatkowej biblioteki w Rust)

### ✅ Faza 4: Inno Setup Installer
- [x] Stworzyć skrypt Inno Setup (.iss):
  - GUI z wyborem portu (domyślnie 8080)
  - Wykrywanie konfliktu portu
  - Kopiowanie plików do Program Files
  - Instalacja NSSM service (przez INSTALL-SERVICE.bat)
  - Konfiguracja firewall (netsh advfirewall)
  - Skróty Start Menu (opcjonalnie Desktop)
  - Uruchomienie usługi po instalacji
  - Uninstaller z usuwaniem serwisu
- [x] Dokumentacja instalatora
- [ ] Dodać ikony i branding
- [ ] Przetestować instalację na czystym systemie

### ✅ Faza 5: Build Pipeline
- [x] Stworzyć `scripts/Build-WindowsInstaller.ps1`:
  1. Build Rust release (`scaleit-bridge.exe`)
  2. Build React (`npm run build` → `dist/`)
  3. Pobranie/setup NSSM automatycznie
  4. Kompilacja Inno Setup Compiler
  5. Wygenerowanie `ScaleCmdBridge-Setup-x64.exe`
- [x] Auto-detekcja Inno Setup Compiler
- [x] Auto-detekcja wersji z Cargo.toml
- [x] Walidacja i error handling na każdym kroku
- [ ] Przetestować pełny build pipeline

### ⏳ Faza 6: EventLog i logi
- [ ] Dodać obsługę Windows EventLog w Rust
- [ ] Konfiguracja logów:
  - Plik: `C:\ProgramData\ScaleCmdBridge\logs\scaleit-bridge.log`
  - EventLog: Application log, source "ScaleCmdBridge"
- [ ] Rotacja logów (max rozmiar, max pliki)

### ✅ Faza 7: Obsługa aktualizacji
- [x] Zaprojektować strategię aktualizacji:
  - In-place upgrade przez instalator (zalecane)
  - Manual upgrade script dla zaawansowanych
  - Zachowanie configu i logów podczas upgrade
- [x] Dodać weryfikację wersji w instalatorze (AppMutex, VersionInfo)
- [x] Dodać backup configu przed aktualizacją (automatyczny)
- [x] Dokumentacja strategii aktualizacji (docs/UPDATE_STRATEGY.md)
- [x] Funkcje pomocnicze w instalatorze (ServiceExists, FirewallRuleNotExists)

### ✅ Faza 8: Dokumentacja
- [x] Zaktualizować README z instrukcją instalacji (sekcja Windows Production Installation)
- [x] Stworzyć WINDOWS_INSTALLATION_GUIDE.md (kompletny przewodnik)
- [x] Dodać troubleshooting guide (w WINDOWS_INSTALLATION_GUIDE.md)
- [x] Dodać przykłady zarządzania usługą (komendy, skrypty)
- [x] Stworzyć UPDATE_STRATEGY.md (strategia aktualizacji)

### ✅ Faza 9: Testy
- [x] Test budowania instalatora (sukces!)
- [x] Naprawa błędów składni Inno Setup
- [x] Weryfikacja wszystkich komponentów
- [ ] Test instalacji na czystym Windows 10/11 (wymaga testu na docelowym systemie)
- [ ] Test zarządzania usługą (start/stop/restart)
- [ ] Test automatycznego uruchamiania po restarcie
- [ ] Test konfiguracji firewall
- [ ] Test aktualizacji (upgrade)

---

## 🏗️ Architektura

### Struktura katalogów po instalacji:

```
C:\Program Files\ScaleCmdBridge\
├── ScaleCmdBridge.exe          # Główny plik wykonywalny
├── nssm.exe                     # NSSM service manager
├── web\                         # Frontend (dist/)
│   ├── index.html
│   ├── assets\
│   └── ...
└── README.md                    # Dokumentacja

C:\ProgramData\ScaleCmdBridge\
├── config\
│   └── devices.json            # Konfiguracja urządzeń
└── logs\
    └── scaleit-bridge.log      # Logi aplikacji
```

### Windows Service Configuration:

- **Nazwa usługi:** `ScaleCmdBridge`
- **Display Name:** `ScaleIT Bridge Service`
- **Description:** `Universal Industrial Scale Communication Bridge`
- **Start Type:** Automatic (SERVICE_AUTO_START)
- **Executable:** `C:\Program Files\ScaleCmdBridge\ScaleCmdBridge.exe`
- **Working Directory:** `C:\Program Files\ScaleCmdBridge\`
- **Logs:** 
  - File: `C:\ProgramData\ScaleCmdBridge\logs\scaleit-bridge.log`
  - EventLog: Application, Source: ScaleCmdBridge

### Port Configuration:

- **Domyślny port:** 8080
- **Konfiguracja:** Plik `.env` lub zmienna środowiskowa `PORT`
- **Firewall:** Automatyczna konfiguracja przez instalator

---

## 🔧 Technologie

- **Windows Service:** NSSM (Non-Sucking Service Manager)
- **Installer:** Inno Setup
- **Build Script:** PowerShell
- **Backend:** Rust (Actix-web) + actix-files
- **Frontend:** React/Vite (statyczne pliki)

---

## 📝 Notatki

### Decyzje techniczne:
- ✅ NSSM zamiast natywnego Windows Service (prostsze, nie wymaga zmian w kodzie)
- ✅ Inno Setup zamiast NSIS/WiX (użytkownik ma już zainstalowane)
- ✅ Frontend jako statyczne pliki w backendzie (jeden port, prostsze)
- ✅ ProgramData dla config/logs (standard Windows, łatwiejsze backup)

### Problemy do rozwiązania:
- [x] Jak obsłużyć SPA routing w Actix (fallback do index.html) - ✅ ROZWIĄZANE: default_handler
- [ ] Jak przekazać port z instalatora do aplikacji (zmienna środowiskowa PORT)
- [ ] Jak obsłużyć upgrade bez utraty configu

---

## 🚀 Status implementacji

**Aktualny etap:** Faza 5 - Build Pipeline ✅ ZAKOŃCZONA

**Następny etap:** Testy instalacji i dokumentacja

**Ostatnia aktualizacja:** 2025-01-11

