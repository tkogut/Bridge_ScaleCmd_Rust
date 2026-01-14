# Multi-Agent ScaleIT Bridge Release 0.2.0

**Status:** 🚧 In Progress  
**Version:** 0.1.5 → 0.2.0  
**Created:** 2026-01-14  
**Approach:** Multi-Agent Orchestration (5 agents)

---

## Przegląd

Plan Release 0.2.0 z wykorzystaniem multi-agent orchestration. Każdy agent pracuje w osobnym oknie Cursor, komunikując się przez wspólne pliki statusu w folderze `coordination/`.

## Reguły projektu (MUST FOLLOW)

### Wersjonowanie
- Aktualna wersja: **0.1.5** (z Cargo.toml)
- Docelowa wersja: **0.2.0** (minor release - nowe funkcje MQTT)
- Pliki do aktualizacji:
  - `src-rust/Cargo.toml` - `version = "0.2.0"`
  - `package.json` - `"version": "0.2.0"`
  - `CHANGELOG.md` - nowa sekcja v0.2.0

### Build Process (KRYTYCZNE)
- ❌ **NIGDY** nie używać bezpośrednio `cargo build` ani `cargo check`
- ✅ **ZAWSZE** używać: `.\scripts\Build-WindowsInstaller.ps1`
- ✅ Dla testów: `.\run-tests.bat` lub `.\test-rust-mingw.ps1`
- Build script automatycznie:
  - Buduje backend przez `build-rust-mingw.ps1 --release --skip-tests`
  - Buduje frontend przez `npm run build`
  - Pobiera NSSM
  - Tworzy installer przez Inno Setup
  - Dla main branch: auto-inkrementuje patch version
  - Dla feature branch: dodaje suffix z nazwą brancha

### Testing
- Backend: `.\test-rust-mingw.ps1` (NIE `cargo test`)
- Frontend: `npm run test`
- E2E: `npm run test:e2e`

---

## Architektura Multi-Agent

### Agent Roles

#### 1. Coordinator Agent (główne okno)
- Monitoruje postępy wszystkich agentów
- Aktualizuje `coordination/status.json`
- Rozwiązuje konflikty
- Finalnie uruchamia build i release

#### 2. Backend Agent (okno 2)
- Implementuje MQTT history module
- Dodaje nowe endpointy API
- Plik statusu: `coordination/backend-status.json`

#### 3. Frontend Agent (okno 3)
- Tworzy MQTT Monitor component
- Dodaje routing i UI
- Plik statusu: `coordination/frontend-status.json`

#### 4. Infrastructure Agent (okno 4)
- Aktualizuje firewall rules w skryptach
- Modyfikuje instalator
- Aktualizuje wersje
- Plik statusu: `coordination/infra-status.json`

#### 5. Testing Agent (okno 5)
- Pisze testy backend (Rust)
- Pisze testy E2E (Playwright)
- Tworzy dokumentację
- Plik statusu: `coordination/testing-status.json`

---

## Protokół komunikacji

### Struktura folderu coordination/

```
coordination/
├── status.json              # Główny status (Coordinator)
├── backend-status.json      # Status Backend Agent
├── frontend-status.json     # Status Frontend Agent
├── infra-status.json        # Status Infrastructure Agent
├── testing-status.json      # Status Testing Agent
└── blockers.json            # Lista blokad między agentami
```

### Format pliku statusu

```json
{
  "agent": "backend",
  "status": "in_progress",
  "current_task": "b2_history_implementation",
  "completed_tasks": ["b1_mqtt_history_module"],
  "blocked_by": [],
  "provides_for": ["frontend", "testing"],
  "last_update": "2026-01-14T10:30:00Z",
  "notes": "History module implemented, API ready for frontend"
}
```

---

## Podział zadań (26 total)

### Phase 1: Infrastructure - Network & Firewall

**Agent:** Infrastructure  
**Zadania:**

- **I1**: Zweryfikować konfigurację Mosquitto w `scripts/Start-Mosquitto-Task.ps1`
  - Sprawdzić czy `listener 1883 0.0.0.0` jest poprawne
  - Sprawdzić czy firewall rule jest dodawany

- **I2**: Dodać firewall rule do `INSTALL-SERVICE.bat`
  ```batch
  netsh advfirewall firewall add rule name="ScaleIT Bridge - MQTT Port 1883" ^
    dir=in action=allow protocol=TCP localport=1883 profile=Private
  ```

- **I3**: Dodać usuwanie firewall rule do `UNINSTALL-SERVICE.bat`

**Zależności:** Brak (można zacząć od razu)  
**Czas:** ~30 min

---

### Phase 2: Backend - MQTT History & API

**Agent:** Backend  
**Zadania:**

- **B1**: Dodać moduł `history` do `src-rust/src/mqtt/mod.rs`
  ```rust
  pub mod history;
  ```

- **B2**: Stworzyć `src-rust/src/mqtt/history.rs`
  - `MqttHistory` struct z circular buffer (max 100 messages)
  - `MqttMessage` struct: topic, payload, timestamp, message_type
  - `MessageType` enum: Weight, Command, Response, Status, Other
  - Metody: `add()`, `get_recent()`, `get_by_type()`, `clear()`

- **B3**: Zmodyfikować `src-rust/src/main.rs`
  - Dodać `mqtt_history` do `AppState`
  - Nowe endpointy:
    - `GET /api/mqtt/status` - status połączenia MQTT
    - `GET /api/mqtt/messages` - ostatnie wiadomości
    - `GET /api/mqtt/messages/{type}` - filtrowanie po typie

**Zależności:** Brak  
**Provides for:** Frontend, Testing  
**Czas:** ~1.5h

---

### Phase 3: Frontend - MQTT Monitor UI

**Agent:** Frontend  
**Zadania:**

- **F1**: Stworzyć `src/components/mqtt/MqttMonitor.tsx`
  - Fetch status z `/api/mqtt/status`
  - Fetch messages z `/api/mqtt/messages`
  - Auto-refresh co 2 sekundy
  - Filtering po message_type
  - UI z ShadCN (Card, Badge, ScrollArea)

- **F2**: Stworzyć `src/pages/Mqtt.tsx` - page wrapper

- **F3**: Dodać routing w `src/App.tsx`
  ```tsx
  <Route path="/mqtt" element={<Mqtt />} />
  ```

- **F4**: Dodać link w `src/components/SidebarNav.tsx`
  - Nowy item: "MQTT Monitor" z ikoną `Radio`

**Zależności:** Backend (B1-B3)  
**Czas:** ~1.5h

---

### Phase 4: Extended Commands & Docs

**Agents:** Backend + Testing  

**Backend:**
- **B4**: Zaktualizować `docs/MQTT_QUICKSTART.md`
  - Tabela z wszystkimi komendami
  - Przykłady mosquitto_pub dla każdej

**Testing:**
- **T1**: Stworzyć `docs/MQTT_NETWORK_TESTING.md`
  - Jak znaleźć IP (ipconfig)
  - Testowanie z innych urządzeń
  - Troubleshooting

**Zależności:** Backend B1-B3  
**Czas:** ~1h

---

### Phase 5: Security Documentation

**Agent:** Testing  

- **T2**: Stworzyć `docs/MQTT_SECURITY.md`
  - Autentykacja Mosquitto
  - Password file (`mosquitto_passwd`)
  - TLS/SSL (opcjonalnie)
  - Best practices

**Zależności:** Brak  
**Czas:** ~30 min

---

### Phase 6: Testing

**Agent:** Testing  

- **T3**: Stworzyć `src-rust/tests/mqtt_integration_test.rs`
  - Test: `MqttConfig::from_env()`
  - Test: `MqttHistory::add()` i `get_recent()`
  - Test: capacity limit
  - Test: filtering

- **T4**: Uruchomić `.\test-rust-mingw.ps1`
  - Sprawdzić czy testy przechodzą
  - Naprawić błędy

- **T5**: Stworzyć `e2e/mqtt-monitor.spec.ts` (opcjonalnie)
  - Test nawigacji do /mqtt
  - Test wyświetlania statusu

**Zależności:** Backend (B1-B3), Frontend (F1-F4)  
**Czas:** ~2h

---

### Phase 7: Documentation

**Agent:** Testing  

- **T6**: Stworzyć `docs/USER_GUIDE.md`
  - Installation
  - Configuration
  - Using MQTT
  - Troubleshooting

- **T7**: Stworzyć `docs/API_REFERENCE.md`
  - Wszystkie HTTP endpoints
  - Request/response formats
  - Examples

- **T8**: Zaktualizować `README.md`
  - Sekcja "MQTT Integration"
  - Quick start
  - Links do dokumentacji

**Zależności:** Backend + Frontend (dla kompletnej dokumentacji)  
**Czas:** ~1.5h

---

### Phase 8: Versioning & Release

**Infrastructure Agent:**

- **I4**: Zaktualizować `src-rust/Cargo.toml` → `version = "0.2.0"`
- **I5**: Zaktualizować `package.json` → `"version": "0.2.0"`
- **I6**: Zaktualizować `CHANGELOG.md` z sekcją v0.2.0

**Coordinator Agent:**

- **C1**: Sprawdzić statusy wszystkich agentów
  - Przeczytać pliki `coordination/*-status.json`
  - Sprawdzić czy wszystkie completed
  - Rozwiązać blockers

- **C2**: Uruchomić **FULL BUILD**
  ```powershell
  .\scripts\Build-WindowsInstaller.ps1
  ```

- **C3**: Testować installer
  - Zainstalować na testowej maszynie
  - Sprawdzić MQTT connectivity
  - Sprawdzić UI

**Zależności:** WSZYSTKIE poprzednie fazy  
**Czas:** ~1h

---

## Sekwencja wykonania

### Równolegle (Start jednocześnie):
1. Infrastructure → I1, I2, I3 (firewall)
2. Backend → B1, B2, B3 (MQTT history + API)
3. Testing → T1, T2 (dokumentacja)

### Po Backend (B1-B3):
4. Frontend → F1, F2, F3, F4 (UI)
5. Backend → B4 (docs)

### Po Backend + Frontend:
6. Testing → T3, T4, T5 (testy)
7. Testing → T6, T7, T8 (dokumentacja)

### Finalnie:
8. Infrastructure → I4, I5, I6 (versioning)
9. Coordinator → C1, C2, C3 (build & release)

---

## Estymowany czas

- **Sekwencyjnie:** ~10h
- **Z równoległością:** **~5-6h** (wall-clock time)

---

## Success Criteria

- [ ] Wszystkie pliki statusu: "completed"
- [ ] Build-WindowsInstaller.ps1 przechodzi bez błędów
- [ ] Wszystkie testy backend przechodzą
- [ ] MQTT Monitor wyświetla dane w UI
- [ ] Installer v0.2.0 działa na testowej maszynie
- [ ] Firewall rules dodawane automatycznie
- [ ] Dokumentacja kompletna

---

## Najważniejsze zasady

1. ❌ **NIE cargo bezpośrednio** - tylko Build-WindowsInstaller.ps1
2. ✅ **Aktualizuj status** po każdym zadaniu
3. ✅ **Sprawdzaj zależności** przed rozpoczęciem
4. ✅ **Testuj incremental** - nie czekaj do końca
5. ✅ **Coordinator ma final say**

---

## Status Tracking

### Setup: ⏳ Pending
- [ ] Folder coordination/ created
- [ ] Status files initialized

### Infrastructure: ⏳ Pending
- [ ] I1: Verify Mosquitto config
- [ ] I2: Add firewall rule (INSTALL)
- [ ] I3: Add firewall rule (UNINSTALL)

### Backend: ⏳ Pending
- [ ] B1: Add history module
- [ ] B2: Create history.rs
- [ ] B3: Add API endpoints
- [ ] B4: Update MQTT docs

### Frontend: ⏳ Pending
- [ ] F1: Create MqttMonitor.tsx
- [ ] F2: Create Mqtt.tsx page
- [ ] F3: Add routing
- [ ] F4: Add sidebar link

### Testing: ⏳ Pending
- [ ] T1: Network testing docs
- [ ] T2: Security docs
- [ ] T3: Integration tests
- [ ] T4: Run backend tests
- [ ] T5: E2E tests (optional)
- [ ] T6: User guide
- [ ] T7: API reference
- [ ] T8: Update README

### Release: ⏳ Pending
- [ ] I4: Version Cargo.toml
- [ ] I5: Version package.json
- [ ] I6: Update CHANGELOG
- [ ] C1: Check statuses
- [ ] C2: Build installer
- [ ] C3: Test installer

---

**Last Updated:** 2026-01-14  
**Coordinator:** AI Agent 1  
