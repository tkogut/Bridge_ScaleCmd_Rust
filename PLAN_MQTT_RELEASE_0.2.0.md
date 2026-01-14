# MQTT Release 0.2.0 - Plan Wdrożenia

## Przegląd

Ten dokument opisuje plan wdrożenia funkcjonalności MQTT w ScaleIT Bridge w wersji 0.2.0.

## Status: W TRAKCIE REALIZACJI

**Data utworzenia:** 2026-01-14
**Koordynator:** Cursor AI Coordinator
**Szacowany czas:** 2-3 dni

---

## Architektura MQTT

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ScaleIT Bridge 0.2.0                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐  │
│  │   React     │────▶│   Rust       │────▶│   Mosquitto         │  │
│  │   Frontend  │     │   Backend    │     │   MQTT Broker       │  │
│  │   (5173)    │◀────│   (8080)     │◀────│   (1883)            │  │
│  └─────────────┘     └──────────────┘     └─────────────────────┘  │
│        │                    │                       │               │
│        │                    │                       │               │
│        ▼                    ▼                       ▼               │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐  │
│  │ MqttStatus  │     │ MQTT History │     │   External          │  │
│  │ MqttConfig  │     │ Store        │     │   Clients           │  │
│  │ Components  │     │ API          │     │   (HA, Node-RED)    │  │
│  └─────────────┘     └──────────────┘     └─────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Agenci i Zadania

### 🏗️ Backend Agent (`cursor/backend-e158`)

| ID | Zadanie | Status | Priorytet | Opis |
|----|---------|--------|-----------|------|
| B1 | Add history module to mqtt/mod.rs | ✅ DONE | High | MqttHistoryStore, WeightReadingEntry, DeviceStatusEntry |
| B2 | Integrate MqttHistoryStore with subscriber | ✅ DONE | High | Automatyczne zapisywanie odczytów |
| B3 | Add API endpoints for MQTT history | ✅ DONE | High | GET/DELETE /api/mqtt/* endpoints |
| B4 | WebSocket for real-time updates | ⏸️ OPTIONAL | Low | Push updates do frontend |
| B5 | MQTT configuration API | ⏸️ OPTIONAL | Low | GET/POST /api/mqtt/config |
| B6 | Prometheus MQTT metrics | ⏸️ OPTIONAL | Low | Metryki dla Grafana |

**Endpoints utworzone (B3):**
- `GET /api/mqtt/status` - Status MQTT
- `GET /api/mqtt/devices` - Lista urządzeń z historią
- `GET /api/mqtt/history/{device_id}` - Historia urządzenia
- `GET /api/mqtt/history/{device_id}/latest` - Najnowsze dane
- `GET /api/mqtt/history/{device_id}/status` - Historia statusów
- `GET /api/mqtt/history/{device_id}/stats` - Statystyki
- `DELETE /api/mqtt/history/{device_id}` - Usuwanie historii

---

### 🎨 Frontend Agent (`cursor/frontend-3ccc`)

| ID | Zadanie | Status | Priorytet | Opis |
|----|---------|--------|-----------|------|
| F1 | MqttStatusCard component | ✅ DONE | High | Karta statusu MQTT |
| F2 | MqttConfigPanel component | ✅ DONE | High | Panel historii i konfiguracji |
| F3 | mqtt-api.ts service | ✅ DONE | High | API client dla MQTT |
| F4 | Integration with Index.tsx | ✅ DONE | High | Dodanie do Dashboard |
| F5 | MQTT Configuration Form | ⏸️ OPTIONAL | Low | UI do konfiguracji MQTT |
| F6 | Weight history chart | ⏸️ OPTIONAL | Low | Wykres odczytów (recharts) |
| F7 | Export to CSV | ⏸️ OPTIONAL | Low | Eksport historii |

**Pliki utworzone:**
- `src/services/mqtt-api.ts`
- `src/components/MqttStatusCard.tsx`
- `src/components/MqttConfigPanel.tsx`

---

### 🔧 Infrastructure Agent (`cursor/infrastructure-b355`)

| ID | Zadanie | Status | Priorytet | Opis |
|----|---------|--------|-----------|------|
| I1 | Verify Mosquitto configuration | ✅ DONE | High | Start-Mosquitto-Task.ps1 |
| I2 | Create coordination infrastructure | ✅ DONE | High | Pliki statusu |
| I3 | Update Inno Setup installer | 🔄 TODO | High | MQTT enabled option |
| I4 | Add MQTT to CI/CD | 🔄 TODO | Medium | GitHub Actions |
| I5 | MQTT Windows Service config | 🔄 TODO | Medium | NSSM environment |
| I6 | Update installation docs | 🔄 TODO | Low | MQTT section |

**Pliki do modyfikacji (I3-I6):**
- `installer/ScaleCmdBridge.iss`
- `.github/workflows/ci-cd.yml`
- `scripts/Configure-MQTT-Service.ps1` (nowy)
- `docs/WINDOWS_INSTALLATION_GUIDE.md`

---

### 🧪 Testing Agent (`cursor/frontend-3ccc`)

| ID | Zadanie | Status | Priorytet | Opis |
|----|---------|--------|-----------|------|
| T1 | MQTT_NETWORK_TESTING.md | ✅ DONE | High | Dokumentacja testów |
| T2 | Unit tests for mqtt-api.ts | ✅ DONE | High | 33 testy serwisu API |
| T3 | Component tests | ✅ DONE | High | 25 testów MqttStatusCard, MqttConfigPanel |
| T4 | Integration tests | 🔄 TODO | Medium | Backend MQTT API (Backend Agent) |
| T5 | E2E tests | ✅ DONE | Medium | 21 testów Playwright MQTT flow |

**Pliki utworzone (T2, T3, T5):**
- `src/services/mqtt-api.test.ts` ✅ (33 tests)
- `src/components/MqttStatusCard.test.tsx` ✅ (14 tests)
- `src/components/MqttConfigPanel.test.tsx` ✅ (11 tests)
- `e2e/mqtt.spec.ts` ✅ (21 tests)
- `src/test/setup.ts` (modified - MQTT handlers)

**Łącznie: 79 testów MQTT**

---

## Kolejność Realizacji (Faza 2)

```
FAZA 1 - UKOŃCZONA ✅
├── Backend: B1, B2, B3
├── Frontend: F1, F2, F3, F4
├── Infrastructure: I1, I2
└── Testing: T1

FAZA 2 - W TRAKCIE 🔄
├── 1. Testing: T2 (unit tests) ✅ DONE - 33 tests
├── 2. Testing: T3 (component tests) ✅ DONE - 25 tests
├── 3. Testing: T5 (E2E tests) ✅ DONE - 21 tests
├── 4. Testing: T4 (backend integration) 🔄 PENDING (Backend Agent)
├── 5. Infrastructure: I3 (installer update) 🔄 TODO
└── 6. Infrastructure: I4, I5, I6 (CI/CD, docs) 🔄 TODO

FAZA 3 - OPCJONALNA ⏸️
├── Backend: B4, B5, B6
└── Frontend: F5, F6, F7
```

---

## Koordynacja Między Agentami

### Pliki Statusu

| Agent | Plik | Branch |
|-------|------|--------|
| Backend | `coordination/backend-status.json` | `cursor/backend-e158` |
| Frontend | `coordination/frontend-status.json` | `cursor/frontend-3ccc` |
| Infrastructure | `coordination/infra-status.json` | `cursor/infrastructure-b355` |
| Testing | `coordination/testing-status.json` | `cursor/testing-693d` |

### Zależności

```
T2, T3 ──────────────► (zależą od F1-F4)
T4 ──────────────────► (zależy od B1-B3)
I3 ──────────────────► (niezależne)
I4, I5 ──────────────► (zależą od I3)
```

---

## Kryteria Akceptacji Release 0.2.0

### Wymagane (Must Have)

- [x] MQTT publisher/subscriber działa
- [x] Historia MQTT zapisywana w pamięci
- [x] API endpoints dla historii MQTT
- [x] UI do przeglądania statusu MQTT
- [x] UI do przeglądania historii MQTT
- [x] Dokumentacja testowania MQTT
- [x] Testy jednostkowe dla nowego kodu (33 unit + 25 component = 58 tests)
- [ ] Installer zaktualizowany o MQTT

### Pożądane (Should Have)

- [ ] Testy integracyjne backend (T4 - pending)
- [x] Testy E2E (21 tests)
- [ ] CI/CD z testami MQTT
- [ ] Zaktualizowana dokumentacja instalacji

### Opcjonalne (Nice to Have)

- [ ] WebSocket real-time updates
- [ ] MQTT configuration UI
- [ ] Wykresy historii
- [ ] Eksport do CSV
- [ ] Metryki Prometheus

---

## Instrukcje dla Agentów

### Testing Agent - START TERAZ

```
1. Przeczytaj: coordination/testing-status.json
2. Rozpocznij: T2 (mqtt-api.test.ts)
3. Po T2: T3 (component tests)
4. Aktualizuj status po każdym zadaniu
5. Push do: cursor/testing-693d
```

### Infrastructure Agent - PO T2

```
1. Przeczytaj: coordination/infra-status.json
2. Rozpocznij: I3 (ScaleCmdBridge.iss)
3. Po I3: I4, I5, I6
4. Aktualizuj status po każdym zadaniu
5. Push do: cursor/infrastructure-b355
```

---

## Kontakt

- **Koordynator:** Cursor AI
- **Repository:** https://github.com/tkogut/Bridge_ScaleCmd_Rust
- **Branch główny:** main
- **Release branch:** (do utworzenia po zakończeniu Fazy 2)
