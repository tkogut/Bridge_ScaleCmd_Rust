# Plan Refaktoryzacji: Host i Miernik

## Cel
Rozdzielenie odpowiedzialności na dwie biblioteki:
- **Host** - Connection, Protocol, Commands (wspólne dla wszystkich wag)
- **Miernik** - Device definitions (definicje konkretnych wag)

## Struktura

```
src-rust/
├── Cargo.toml (workspace)
├── host/                    # Biblioteka Host
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── connection.rs     # TCP/Serial connections
│       ├── protocol.rs       # Protocol definitions (RINCMD, DINI_ASCII)
│       ├── commands.rs       # Command execution
│       └── error.rs          # Host errors
├── miernik/                  # Biblioteka Miernik (Device)
│   ├── Cargo.toml
│   └── src/
│       ├── lib.rs
│       ├── device.rs         # Device adapter trait
│       ├── models.rs         # WeightReading, DeviceConfig
│       └── error.rs          # Device errors
└── src/                      # Główna aplikacja (scaleit-bridge)
    └── ...
```

## Podział odpowiedzialności

### Host Library (`scaleit-host`)
- **Connection**: Zarządzanie połączeniami TCP/Serial
- **Protocol**: Definicje protokołów (RINCMD, DINI_ASCII)
- **Commands**: Wykonywanie komend i odbieranie odpowiedzi
- **Error**: Błędy związane z połączeniem i komunikacją

### Miernik Library (`scaleit-miernik`)
- **Device**: Definicje konkretnych wag (Rinstrum C320, Dini Argeo DFW)
- **Models**: Modele danych (WeightReading, DeviceConfig)
- **Error**: Błędy związane z urządzeniami

## Następne kroki

1. ✅ Utworzenie struktury workspace
2. ✅ Utworzenie podstawowych modułów
3. ⏳ Migracja kodu z adapterów do Host
4. ⏳ Migracja definicji urządzeń do Miernik
5. ⏳ Aktualizacja głównej aplikacji do używania nowych bibliotek
6. ⏳ Testy i weryfikacja

## Przykład użycia (docelowy)

```rust
use scaleit_host::{Connection, Protocol, CommandExecutor};
use scaleit_miernik::{Device, DeviceAdapter};

// 1. Utworzenie połączenia (Host)
let connection = Arc::new(Connection::tcp(
    "192.168.1.254".to_string(),
    4001,
    5000
));

// 2. Utworzenie protokołu (Host)
let protocol = Protocol::Rincmd;

// 3. Utworzenie urządzenia (Miernik)
let mut commands = HashMap::new();
commands.insert("readGross".to_string(), "20050026".to_string());
commands.insert("zero".to_string(), "21120008:0B".to_string());

let device = Device::new(
    "scale1".to_string(),
    connection,
    protocol,
    commands
);

// 4. Użycie
device.connect().await?;
let reading = device.execute_command("readGross").await?;
```

