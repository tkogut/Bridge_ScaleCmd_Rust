Jesteś senior Windows/Rust/DevOps engineerem. Pracujesz nad projektem ScaleCmdBridge / ScaleIT Bridge.

Kontekst techniczny
Backend: Rust (Actix), skompilowany jako scaleit-bridge.exe, port 8080 (HTTP API: /health, /devices, /scalecmd, /api/*).​

Frontend: React/Vite, dev na http://localhost:5173, w produkcji zbuildowany do dist/ (panel do konfiguracji bridge i diagnostyki).​

Obecnie backend i frontend działają poprawnie po ręcznym uruchomieniu zgodnie z README – testowane lokalnie, komunikacja z wagami OK.​

Docelowa nazwa usługi Windows: ScaleCmdBridge, binarka: ScaleCmdBridge.exe (wrap lub rename scaleit-bridge.exe).​

Cel
Zaprojektuj i opisz kompletne, produkcyjne rozwiązanie Windows installer + Windows Service, tak aby:

Użytkownik końcowy pobiera jeden plik instalacyjny ze strony aplikacji (np. ScaleCmdBridge-Setup-x64.exe).

Po kliknięciu instalatora:

Instalowane są wszystkie pliki (backend ScaleCmdBridge.exe, frontend dist/, config, skrypty).

Tworzony jest i uruchamiany Windows Service ScaleCmdBridge, który nasłuchuje na http://localhost:8080.

Frontend jest dostępny jako aplikacja webowa (np. wbudowany w backend jako statyczne pliki pod http://localhost:8080 albo osobny http://localhost:5173 tylko w trybie konfiguracji – opisz wariant i rekomendację).

Nie ma potrzeby instalowania Rust, Node, MSYS2, ani żadnych dodatkowych pakietów przez użytkownika.

Po restarcie Windows usługa startuje automatycznie.

Instalator konfiguruje firewall, logi, katalog konfiguracyjny i tworzy skróty (Start Menu / opcjonalnie desktop).

Idealnie: instalator wykrywa konflikt portu 8080 i pozwala wybrać inny port, zapisując go do pliku konfiguracyjnego, a serwis go respektuje.

Wymagania szczegółowe
Poproszę:

Architekturę instalera i serwisu

Jakie katalogi na docelowej maszynie (np. C:\Program Files\ScaleCmdBridge\, C:\ProgramData\ScaleCmdBridge\config, logs itd.).

Gdzie trafia backend EXE, gdzie frontend dist, gdzie config (devices.json + app config).

Jak serwis ma ładować config i skąd serwować frontend (statyczne pliki przez Actix?).​

Windows Service – projekt techniczny

Dokładna komenda sc.exe / PowerShell (New-Service) do utworzenia usługi ScaleCmdBridge wskazującej na ScaleCmdBridge.exe z parametrami (port, ścieżka do configu).

Propozycja wrappera (np. malutki ScaleCmdBridgeService.exe lub użycie nssm.exe vs. wbudowany service wrapper w Rust) – decyzja + uzasadnienie.

Jak obsłużyć logi (plik w ProgramData + EventLog).

Installer (NSIS / WiX / Inno Setup – wybierz jedno)

Rekomendowane narzędzie (np. NSIS) – podaj powody.

Struktura projektu instalatora.

Przykładowy skrypt instalatora (NSIS/ Inno) z:

kopiowaniem plików,

tworzeniem usługi ScaleCmdBridge,

ustawieniem StartType=Automatic,

konfiguracją firewall (netsh advfirewall firewall add rule ...),

uruchomieniem usługi po instalacji,

opcjonalnie: prosty ekran wyboru portu (domyślnie 8080).

Build pipeline

Krok po kroku: jak z obecnego repo (src-rust, dist/, scripts/) stworzyć gotowy instalator:

build Rust release (scaleit-bridge.exe → ScaleCmdBridge.exe),

build React (npm run build → dist/),

przygotowanie struktury katalogów,

uruchomienie narzędzia instalatora i wygenerowanie ScaleCmdBridge-Setup-x64.exe.

Wszystko w formie jednego skryptu PowerShell (np. scripts\Build-WindowsInstaller.ps1).

Obsługa aktualizacji

Jak zaprojektować upgrade: nowy instalator vs. osobny updater.

Co z configiem i logami