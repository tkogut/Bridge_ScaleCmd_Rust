# Dini Argeo DFW – Mapowanie protokołu komunikacji

## Podsumowanie mapowania komend

| Funkcja programu | Komenda DFW | Opis | Format |
|------------------|------------|------|--------|
| **readGross** | `READ` | Odczyt wagi brutto (razem z pojemnikiem) | `nnREAD<CR><LF>` |
| **readNet** | `REXT` | Odczyt wagi netto (waga bez pojemnika) z danymi pełnymi | `nnREXT<CR><LF>` |
| **tare** | `TARE` | Tara półautomatyczna – zerowanie pojemnika | `nnTARE<CR><LF>` |
| **zero** | `ZERO` | Zero – zerowanie wagi (reset) | `nnZERO<CR><LF>` |

---

## Parametry połączenia

- **Baud rate**: 9600 (domyślnie) – dostępne również: 1200, 2400, 4800, 19200, 38400, 57600, 115200
- **Format**: n-8-1 (8 bitów danych, 1 bit stopu, bez parzystości)
- **Terminator komend**: `<CR><LF>` (ASCII 13 + 10)
- **Port**: COM 1 lub COM 2 (RS232/RS485)
- **Tryb komunikacji**: Com.PC (do komunikacji z komputerem)

---

## Szczegóły komend

### 1. readGross – `READ`
Odczyt wagi brutto (masa całkowita wraz z pojemnikiem)

**Komenda**:
```
nnREAD<CR><LF>
```

**Odpowiedź (short string)**:
```
nnST,GS,XXXXXX.XX,kg<CR><LF>
```

**Przykład**:
```
Wysłano: READ<CR><LF>
Otrzymano: st,GS,    25.50,kg<CR><LF>
```

---

### 2. readNet – `REXT`
Odczyt wagi netto (masa bez pojemnika) – format rozszerzony

**Komenda**:
```
nnREXT<CR><LF>
```

**Odpowiedź (extended string)**:
```
nnST,1,XXXXXX.XX,PT XXXXXX.XX,XXXXXX,kg<CR><LF>
```

**Gdzie**:
- `nn` – kod urządzenia (tylko w trybie RS485)
- `ST` – status wagi (st=stabilna, us=niestabilna, ol=przeciążenie, ul=niedociążenie)
- `1` – typ pomiaru (netto)
- `XXXXXX.XX` – wartość wagi netto (10 znaków)
- `PT XXXXXX.XX` – wartość tary (PT = preset tare, 10 znaków)
- `XXXXXX` – licznik sztuk (10 znaków)
- `kg` – jednostka

**Przykład**:
```
Wysłano: REXT<CR><LF>
Otrzymano: st,1,    15.30,PT     10.20,         0,kg<CR><LF>
```

---

### 3. tare – `TARE`
Tara półautomatyczna – zerowanie pojemnika

**Komenda**:
```
nnTARE<CR><LF>
```

**Odpowiedź**:
```
OK<CR><LF>
```

**Przykład**:
```
Wysłano: TARE<CR><LF>
Otrzymano: OK<CR><LF>
```

**Uwagi**:
- Wykonuje tację półautomatyczną – zapamiętuje aktualną wagę pojemnika
- Następnie wyświetlana waga jest pomniejszona o tę wartość (waga netto)

---

### 4. zero – `ZERO`
Zerowanie wagi – reset do zera

**Komenda**:
```
nnZERO<CR><LF>
```

**Odpowiedź**:
```
OK<CR><LF>
```

**Przykład**:
```
Wysłano: ZERO<CR><LF>
Otrzymano: OK<CR><LF>
```

**Uwagi**:
- Resetuje wyświetlaną wagę do zera
- Czyszczenie wartości tary
- Przygotowuje wagę do nowego pomiaru

---

## Kody statusu (Status codes)

| Kod | Znaczenie |
|-----|-----------|
| `st` | **Stabilna** – wynik pomiaru jest stabilny, można go odczytać |
| `us` | **Niestabilna** – waga się nie ustaliła, wartość zmienia się |
| `ol` | **Przeciążenie** – masa przekroczyła maksymalny limit urządzenia |
| `ul` | **Niedociążenie** – masa poniżej minimalnego limitu |

---

## Instrukcja konfiguracji w urządzeniu

Aby skonfigurować port do komunikacji z Twoim programem:

1. Wejdź w **MENU** → **SETUP** (naciśnij klawisz C podczas startu)
2. Przejdź do **SEriAL** (punkt D)
3. Wybierz **Com.PC** (port komunikacji z PC/PLC)
4. Ustaw:
   - **MODE**: Com.PC
   - **BAUD**: 9600
   - **BIT**: n-8-1
5. Wybierz **AdvanC** (ustawienia zaawansowane)
6. Ustaw:
   - **protoC** (protokół): Short lub Extended
   - **terM** (terminator): CRLF

---

## Notatki implementacyjne

- Wszystkie komendy muszą być zakończone `<CR><LF>`
- Parametr `nn` (adres) jest wymagany tylko w trybie RS485
- W trybie RS232 zwykle `nn` jest opuszczany
- Odpowiedzi zawsze zawierają kod statusu wagi
- Port domyślnie pracuje z parzystością **none** (n)
- Gwarantowana aktualizacja danych: **8 tx/sec** w trybie repeater

---

## Przykładowy sekwencyjny odczyt wagi

```
1. Zerowanie:
   Wysłano: ZERO<CR><LF>
   Otrzymano: OK<CR><LF>

2. Umieszczenie pojemnika:
   (brak komendy – oczekiwanie)

3. Tara pojemnika:
   Wysłano: TARE<CR><LF>
   Otrzymano: OK<CR><LF>

4. Dodanie produktu:
   (oczekiwanie na ustabilizowanie się wagi)

5. Odczyt wagi netto:
   Wysłano: REXT<CR><LF>
   Otrzymano: st,1,    15.30,PT     10.20,         0,kg<CR><LF>

6. Powtórny odczyt brutto:
   Wysłano: READ<CR><LF>
   Otrzymano: st,GS,    25.50,kg<CR><LF>
```

---

Dokumentacja na podstawie: **Technical Manual DFW V5 – Dini Argeo** (sekcje 6-7, strony 41-42)
