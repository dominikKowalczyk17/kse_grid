Executive Summary

Raport zbiera wiedzę domenową niezbędną do zrozumienia rozpływów mocy oraz praktyczne informacje o dwóch powszechnie używanych narzędziach: pandapower (Python) i MATPOWER (MATLAB/Octave). Zawiera: skrócone wprowadzenie do elektroenergetyki i pojęć P/Q, opis metod numerycznych (Newton–Raphson, Fast Decoupled, Gauss–Seidel, DC), analizę implementacji w pandapower i MATPOWER, opis konwersji między formatami oraz praktyczne rekomendacje do migracji i walidacji. Każde ważne twierdzenie ma przypis do źródła.

1. Klasyfikacja zapytania

To zadanie: technical deep-dive + praktyczny przewodnik. Obejmuje zarówno wyjaśnienie koncepcji, jak i odniesienia do implementacji oraz instrukcje interoperacyjności.

2. Kluczowe pojęcia elektroenergetyczne (skrócone)

- Sieć: graf jedno-liniowy (buses/węzły i branches/gałęzie) reprezentujący generatory, transformatory, linie i obciążenia.[^1]
- Moc: S = P + jQ; P — moc czynna, Q — bierna; analizy rozpływu działają w dziedzinie fasorów (per‑unit preferowany).[ ^2][^3]
- Typy węzłów: PQ (zadane P,Q), PV (zadane P,|V|), Slack/REF (zadane |V| i θ). Rozpływ rozwiązuje nieznane kąty i moduły napięć odpowiadające typom węzłów.[^4]

3. Metody numeryczne — przegląd i praktyka

- Newton–Raphson (pełny AC): budowa wektora niespełnień ΔP, ΔQ oraz Jacobiana J = [[∂P/∂θ ∂P/∂|V|];[∂Q/∂θ ∂Q/∂|V|]]; iteracyjny krok J Δx = mismatch; szybka zbieżność lokalna, wymaga sparse‑LU/iterative solvera i obsługi limitów Q (PV→PQ)[^5][^6].

- Fast Decoupled (FDLF): upraszcza Jacobiana do dwóch stałych macierzy B' i B'' (≈ -Im(Ybus)), osobne iteracje dla P→θ i Q→|V|; mniejszy koszt per iteracji, użyteczny operacyjnie, mniej uniwersalny niż NR.[^7]

- Gauss–Seidel: prosty algorytm iteracyjny (successive substitution), wolna zbieżność; użyteczny edukacyjnie i dla małych sieci.[^8]

- DC power‑flow: liniowa aproksymacja zakładająca |V|≈1, sin(Δθ)≈Δθ i pomijając Q; szybka metoda do planowania/optymalizacji (nie nadaje się do analizy napięć/Q).[ ^9]

4. Implementacje — pandapower (Python)

- Architektura: użytkownik tworzy obiekt net (pandas DataFrame’y: net.bus, net.line, net.trafo, net.load, net.gen, net.ext_grid...). Wywołanie pp.runpp(net) -> pandapower/run.py -> pandapower/powerflow.py -> _pd2ppc (konwersja do ppc/ppci) -> wybór algorytmu i uruchomienie konkretnego solvera (np. Newton‑Raphson w pandapower/pf/run_newton_raphson_pf.py).[ ^10][^11]

- Dane: funkcja _pd2ppc tworzy strukturę ppc zgodną z PYPOWER/MATPOWER (bus/gen/branch arrays) i mapuje kolumny (vn_kv, p_mw, q_mvar, r_ohm_per_km, x_ohm_per_km, tap, shift, itp.).[ ^12]

- Newton–Raphson w pandapower: implementacja znajduje się w pandapower/pf/run_newton_raphson_pf.py; obsługa enforce_q_lims i pętli PV→PQ jest zaimplementowana (korekta typów bus po przekroczeniu limitów Q).[ ^13]

- Konwersje: pandapower udostępnia funkcje pandapower.converter.matpower.from_mpc i to_mpc (round‑trip), a mechanizm opiera się o pośrednią konwersję do ppc (pypower) -> pandapower i odwrotnie.[^14][^15]

5. Implementacje — MATPOWER (MATLAB/Octave)

- Struktura: MATPOWER trzyma funkcje PF/OPF w katalogu lib/ (runpf.m, newtonpf.m, fdpf.m, makeB.m) oraz przykładowe case’y w data/ (case9.m, case14.m itd.).[ ^16]

- Newton w MATPOWER: newtonpf.m buduje Jacobiana (wywołuje dSbus_dV), rozwiązuje układ liniowy (lin_solver zależny od ustawień) i zarządza kryteriami stopu; runpf.m wybiera algorytm i wywołuje newtonpf lub fdpf.[^17][^18]

- Fast Decoupled: fdpf.m i makeB.m tworzą macierze Bp/Bpp używane w szybkich iteracjach; to optymalizacja kosztów iteracji i pamięci przy typowych sieciach.[^19]

6. Interoperacyjność i pułapki konwersji

- Indeksy (MATLAB 1‑based vs Python 0‑based): konwertery mapują indeksy (odejmując/dodając 1) podczas importu/eksportu.[^20]

- TAP/konwencje transformatorów: pandapower konwertuje wartości TAP (np. przy imporcie z MATPOWER ustawia ppc.branch[:,8]==0 -> 1; przy eksporcie przywraca 1->0). Należy ręcznie zweryfikować tapy i modele transformatorów po konwersji.[^21][^22]

- Specjalne elementy (3‑winding trafo, asymetryczne branchy, niestandardowe shunts, modele dynamiczne) mogą wymagać ręcznego mapowania lub uproszczenia; zawsze wykonać round‑trip i porównać wyniki (res_bus, res_line).[^23]

7. Rekomendowane workflowy

- Prototypowanie / badania: używajpandapower (łatwość integracji z ekosystemem Python). Do porównań z algorytmami lub istniejącym MATLAB‑owym łańcuchem użyć to_mpc/from_mpc i wykonać porównania wyników (uruchomić runpp/ runpf w obu środowiskach i porównać res_bus/res_line).[ ^14][^16]

- Migracja produkcyjna: przygotować zestaw testów akceptacyjnych (IEEE/CIGRE cases), wykonać round‑trip każdej sieci, zautomatyzować porównanie kluczowych metryk (Vm_pu, Va_deg, P/Q flows) i walidować trafo/tapy/shunts ręcznie.[^23]

- Wydajność: MATPOWER może być szybszy w dużych przypadkach dzięki zoptymalizowanym solwerom w MATLABie; pandapower oferuje wygodę i integrację z Pandas, ale należy monitorować koszty konwersji i ewentualnie używać skompilowanych bibliotek liniowych (MKL, SuiteSparse) dla poprawy wydajności.[^24]

8. Confidence Assessment

- Pewność wysoka: podstawowe pojęcia elektroenergetyczne, opis metod numerycznych (NR, FDLF, GS, DC) oraz lokalizacje głównych plików źródłowych w pandapower i MATPOWER (wskazane pliki i ich role). Źródła: pandapower GH, MATPOWER GH, klasyczne podręczniki/artykuły wymienione w bibliografii.[^10][^16][^5]

- Pewność umiarkowana: szczegóły implementacyjne (drobne różnice w konwencjach tapów, edge‑case’y konwerterów) — opisane przykłady pochodzą z kodu konwerterów, ale zalecam walidację na konkretnych przypadkach testowych przed masową migracją.[^21][^22]

- Inferred / assumptions: brak pełnych, porównawczych benchmarków publikowanych oficjalnie; rekomendacja wykonania reproducible benchmarków opiera się na obserwacjach issue/PR w repo i typowych ograniczeniach środowiskowych.[^24]

9. Główne odwołania (footnotes)

[^1]: [Power flow / general](https://en.wikipedia.org/wiki/Power_flow_study)
[^2]: Grainger & Stevenson, Power System Analysis (książka referencyjna)
[^3]: [Per‑unit system](https://en.wikipedia.org/wiki/Per-unit_system)
[^4]: [Bus types / power flow](https://en.wikipedia.org/wiki/Power_flow_study)
[^5]: [Newton–Raphson theory and Jacobian — MATPOWER implementation: lib/newtonpf.m](https://github.com/MATPOWER/matpower/blob/master/lib/newtonpf.m)
[^6]: [dSbus_dV / Jacobian building — MATPOWER helpers](https://github.com/MATPOWER/matpower/blob/master/lib/dSbus_dV.m)
[^7]: [Fast Decoupled — makeB.m and fdpf.m in MATPOWER](https://github.com/MATPOWER/matpower/blob/master/lib/makeB.m)
[^8]: [Gauss–Seidel overview](https://en.wikipedia.org/wiki/Power_flow_study)
[^9]: [DC power flow overview](https://en.wikipedia.org/wiki/Power_flow_study)
[^10]: [pandapower run entrypoints: pandapower/run.py and pandapower/powerflow.py](https://github.com/e2nIEE/pandapower/blob/main/pandapower/run.py)
[^11]: [pd2ppc (net -> ppc) mapping: pandapower/pd2ppc.py](https://github.com/e2nIEE/pandapower/blob/main/pandapower/pd2ppc.py)
[^12]: [pd2ppc implementation and mapping details](https://github.com/e2nIEE/pandapower/blob/main/pandapower/pd2ppc.py)
[^13]: [pandapower Newton–Raphson solver implementation: pandapower/pf/run_newton_raphson_pf.py](https://github.com/e2nIEE/pandapower/blob/main/pandapower/pf/run_newton_raphson_pf.py)
[^14]: [pandapower converter: from_mpc (MATPOWER->pandapower)](https://github.com/e2nIEE/pandapower/blob/main/pandapower/converter/matpower/from_mpc.py#L26-L77)
[^15]: [pandapower converter: to_mpc (pandapower->MATPOWER)](https://github.com/e2nIEE/pandapower/blob/main/pandapower/converter/matpower/to_mpc.py#L19-L47)
[^16]: [MATPOWER runpf / case format / repo](https://github.com/MATPOWER/matpower)
[^17]: [MATPOWER runpf (algorithm selection) — lib/runpf.m](https://github.com/MATPOWER/matpower/blob/master/lib/runpf.m)
[^18]: [MATPOWER newtonpf (NR implementation) — lib/newtonpf.m](https://github.com/MATPOWER/matpower/blob/master/lib/newtonpf.m)
[^19]: [MATPOWER fdpf / makeB (fast decoupled matrices)](https://github.com/MATPOWER/matpower/blob/master/lib/fdpf.m)
[^20]: [Indexing conversions in pandapower converters (1-based <-> 0-based)](https://github.com/e2nIEE/pandapower/blob/main/pandapower/converter/matpower/from_mpc.py#L115-L123)
[^21]: [TAP correction on import: from_mpc _change_ppc_TAP_value (ppc.branch[:,8]==0 -> 1)](https://github.com/e2nIEE/pandapower/blob/main/pandapower/converter/matpower/from_mpc.py#L148-L150)
[^22]: [TAP correction on export: to_mpc _ppc2mpc (mpc.branch[:,8]==1 -> 0)](https://github.com/e2nIEE/pandapower/blob/main/pandapower/converter/matpower/to_mpc.py#L67-L68)
[^23]: [Caveats: special elements and need for manual validation — pandapower converter docs](https://pandapower.readthedocs.io/en/stable/converter/matpower.html)
[^24]: [Performance notes and issues referenced in pandapower issues / MATPOWER comparisons (recommend custom benchmarking)](https://github.com/e2nIEE/pandapower/issues)

Appendix: Recommended next steps

- Jeśli chcesz pełne fragmenty kodu z numerami linii dla konkretnych funkcji (np. pełna implementacja _run_newton_raphson_pf z pandapower, albo pętle w newtonpf.m i fragmenty makeB.m), zaznacz które fragmenty najbardziej Cię interesują (lub potwierdź "wykonać pełne ekstrakcje run_newton_raphson_pf.py, pd2ppc.py, runpf.m, newtonpf.m, fdpf.m").

- Proponuję również utworzyć skrypt round‑trip (pandapower -> .mat -> pandapower) i automatyczną walidację wyników (net.res_bus, net.res_line). Mogę go wygenerować i zapisać w repo sesji.

- Możemy też przygotować reproducible benchmark i skrypt pomiarowy porównujący czasy wykonania w pandapower vs MATPOWER.


-- koniec raportu --
