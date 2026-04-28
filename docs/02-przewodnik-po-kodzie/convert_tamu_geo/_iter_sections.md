# `_iter_sections`

**Plik źródłowy:** `kse_grid\convert_tamu_geo.py`  
**Rodzaj:** funkcja

## Co robi

Rozbija tekst pliku `.EPC` na logiczne sekcje typu `substation data [...]`, `bus data [...]` itd. Zwraca iterator par:

```python
(section_name, rows)
```

gdzie `rows` to surowe wiersze należące do danej sekcji.

## Nagłówek funkcji

```python
def _iter_sections(text: str) -> Iterator[tuple[str, list[str]]]:
```

## Co dzieje się w środku

1. czyta plik linia po linii,
2. rozpoznaje początek sekcji przez `SECTION_RE`,
3. gdy widzi nową sekcję, emituje poprzednią,
4. linie `end` oraz `injgroup data  [  0]` traktuje jako zamknięcie sekcji,
5. zbiera tylko niepuste wiersze należące do aktualnego bloku.

## Po co istnieje

Plik EPC nie jest JSON-em ani CSV. To tekstowy format blokowy, więc najpierw trzeba go pociąć na sekcje, a dopiero potem można osobno parsować bus'y i stacje.
