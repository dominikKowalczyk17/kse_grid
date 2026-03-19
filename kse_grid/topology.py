from dataclasses import dataclass
from kse_grid.models import BusConfig, LineConfig, TrafoConfig, GenConfig, LoadConfig, ShuntConfig


class KSETopology:
    """Surowe dane topologiczne KSE (stacje, linie, trafos itp.)"""

    LT400 = "400kV_Wiazka_3x_AFL8_525"   # istniejący typ pandapower (380 = tier 400kV)
    LT220 = "243-AL1/39-ST1A 220.0"   # własny typ – rejestrowany w GridBuilder
    AT    = "AT 275MVA 400/220kV"      # własny typ autotransformatora

    BUSES_400KV: list[BusConfig] = [
        # Północ
        BusConfig("Gdańsk Błonia 400kV",      400, 54.37, 18.65),
        BusConfig("Żarnowiec 400kV",          400, 54.57, 18.17),
        BusConfig("Krajnik 400kV",            400, 53.17, 14.27),
        BusConfig("Dunowo 400kV",             400, 54.27, 16.35),
        BusConfig("Bydgoszcz Zachód 400kV",   400, 53.15, 17.90),
        # Centrum / Warszawa
        BusConfig("Miłosna 400kV",            400, 52.23, 21.32),
        BusConfig("Kozienice 400kV",          400, 51.58, 21.55),
        BusConfig("Warszawa Wschód 400kV",    400, 52.21, 21.07),
        BusConfig("Siedlce Ujrzanów 400kV",   400, 52.18, 22.22),
        # Zachód
        BusConfig("Plewiska 400kV",           400, 52.33, 16.75),
        BusConfig("Adamów 400kV",             400, 51.67, 19.47),
        BusConfig("Rogowiec 400kV",           400, 51.27, 19.45),
        # Południe
        BusConfig("Turów 400kV",              400, 50.90, 14.93),
        BusConfig("Kopanina 400kV",           400, 50.27, 18.87),
        BusConfig("Byczyna 400kV",            400, 51.02, 18.17),
        BusConfig("Połaniec 400kV",           400, 50.47, 21.28),
        BusConfig("Rzeszów 400kV",            400, 50.04, 22.00),
        BusConfig("Lublin Systemowa 400kV",   400, 51.25, 22.57),
    ]

    BUSES_220KV: list[BusConfig] = [
        BusConfig("Gdańsk I 220kV",             220, 54.37, 18.65),
        BusConfig("Żydowo 220kV",               220, 54.00, 16.60),
        BusConfig("Czerwonak 220kV",            220, 52.47, 16.98),
        BusConfig("Pątnów 220kV",               220, 52.25, 18.23),
        BusConfig("Łódź Chocianowicka 220kV",   220, 51.77, 19.55),
        BusConfig("Wrocław 220kV",              220, 51.10, 17.05),
        BusConfig("Dobrzeń 220kV",              220, 50.72, 17.88),
        BusConfig("Blachownia 220kV",           220, 50.77, 18.95),
        BusConfig("Klikowa 220kV",              220, 50.02, 20.98),
        BusConfig("Stalowa Wola 220kV",         220, 50.57, 22.05),
        BusConfig("Lubocza 220kV",              220, 50.00, 20.78),
        BusConfig("Chmielów 220kV",             220, 50.67, 21.47),
        BusConfig("Radom 220kV",                220, 51.42, 21.15),
    ]

    LINES_400KV: list[LineConfig] = [
        # Pierścień północny (jednotorowe - wystarczająca redundancja)
        LineConfig("Gdańsk Błonia 400kV", "Żarnowiec 400kV", 55, LT400, "LNN Gdańsk–Żarnowiec 400kV"),
        LineConfig("Gdańsk Błonia 400kV", "Dunowo 400kV", 140, LT400, "LNN Gdańsk–Dunowo 400kV"),
        LineConfig("Dunowo 400kV", "Bydgoszcz Zachód 400kV", 90, LT400, "LNN Dunowo–Bydgoszcz 400kV"),
        LineConfig("Bydgoszcz Zachód 400kV", "Plewiska 400kV", 95, LT400, "LNN Bydgoszcz–Plewiska 400kV"),
        LineConfig("Żarnowiec 400kV", "Krajnik 400kV", 120, LT400, "LNN Żarnowiec–Krajnik 400kV"),
        LineConfig("Krajnik 400kV", "Dunowo 400kV", 160, LT400, "LNN Krajnik–Dunowo 400kV"),

        # Zachód–Centrum (dwutorowe - główne korytarze)
        LineConfig("Plewiska 400kV", "Adamów 400kV", 175, LT400, "LNN Plewiska–Adamów 400kV T1"),
        LineConfig("Plewiska 400kV", "Adamów 400kV", 175, LT400, "LNN Plewiska–Adamów 400kV T2"),
        LineConfig("Adamów 400kV", "Rogowiec 400kV", 55, LT400, "LNN Adamów–Rogowiec 400kV"),
        LineConfig("Rogowiec 400kV", "Byczyna 400kV", 72, LT400, "LNN Rogowiec–Byczyna 400kV T1"),
        LineConfig("Rogowiec 400kV", "Byczyna 400kV", 72, LT400, "LNN Rogowiec–Byczyna 400kV T2"),
        LineConfig("Byczyna 400kV", "Kopanina 400kV", 90, LT400, "LNN Byczyna–Kopanina 400kV T1"),
        LineConfig("Byczyna 400kV", "Kopanina 400kV", 90, LT400, "LNN Byczyna–Kopanina 400kV T2"),
        LineConfig("Rogowiec 400kV", "Adamów 400kV", 55, LT400, "LNN Rogowiec–Adamów 400kV T1"),
        LineConfig("Rogowiec 400kV", "Adamów 400kV", 55, LT400, "LNN Rogowiec–Adamów 400kV T2"),
        LineConfig("Adamów 400kV", "Kozienice 400kV", 142, LT400, "LNN Adamów–Kozienice 400kV T1"),
        LineConfig("Adamów 400kV", "Kozienice 400kV", 142, LT400, "LNN Adamów–Kozienice 400kV T2"),

        # Warszawa (dwutorowe - kluczowe zasilanie stolicy)
        LineConfig("Kozienice 400kV", "Warszawa Wschód 400kV", 120, LT400, "LNN Kozienice–Warszawa Wschód 400kV T1"),
        LineConfig("Kozienice 400kV", "Warszawa Wschód 400kV", 120, LT400, "LNN Kozienice–Warszawa Wschód 400kV T2"),
        LineConfig("Miłosna 400kV", "Warszawa Wschód 400kV", 20, LT400, "LNN Miłosna–Warszawa Wschód 400kV T1"),
        LineConfig("Miłosna 400kV", "Warszawa Wschód 400kV", 20, LT400, "LNN Miłosna–Warszawa Wschód 400kV T2"),
        LineConfig("Siedlce Ujrzanów 400kV", "Warszawa Wschód 400kV", 90, LT400,
                   "LNN Siedlce–Warszawa Wschód 400kV T1"),
        LineConfig("Siedlce Ujrzanów 400kV", "Warszawa Wschód 400kV", 90, LT400,
                   "LNN Siedlce–Warszawa Wschód 400kV T2"),

        # Centrum (dwutorowe na głównych trasach)
        LineConfig("Bydgoszcz Zachód 400kV", "Miłosna 400kV", 260, LT400, "LNN Bydgoszcz–Miłosna 400kV T1"),
        LineConfig("Bydgoszcz Zachód 400kV", "Miłosna 400kV", 260, LT400, "LNN Bydgoszcz–Miłosna 400kV T2"),
        LineConfig("Plewiska 400kV", "Kozienice 400kV", 210, LT400, "LNN Plewiska–Kozienice 400kV"),  # Zapasowa
        LineConfig("Kozienice 400kV", "Miłosna 400kV", 95, LT400, "LNN Kozienice–Miłosna 400kV T1"),
        LineConfig("Kozienice 400kV", "Miłosna 400kV", 95, LT400, "LNN Kozienice–Miłosna 400kV T2"),

        # Wschód (jednotorowe - niższe obciążenie)
        LineConfig("Miłosna 400kV", "Siedlce Ujrzanów 400kV", 70, LT400, "LNN Miłosna–Siedlce 400kV"),
        LineConfig("Siedlce Ujrzanów 400kV", "Lublin Systemowa 400kV", 130, LT400, "LNN Siedlce–Lublin 400kV"),
        LineConfig("Kozienice 400kV", "Lublin Systemowa 400kV", 100, LT400, "LNN Kozienice–Lublin 400kV"),

        # Południowy Wschód (dwutorowe - zasilanie Rzeszowa/Lublina)
        LineConfig("Lublin Systemowa 400kV", "Rzeszów 400kV", 160, LT400, "LNN Lublin–Rzeszów 400kV T1"),
        LineConfig("Lublin Systemowa 400kV", "Rzeszów 400kV", 160, LT400, "LNN Lublin–Rzeszów 400kV T2"),
        LineConfig("Połaniec 400kV", "Lublin Systemowa 400kV", 110, LT400, "LNN Połaniec–Lublin 400kV"),
        LineConfig("Połaniec 400kV", "Rzeszów 400kV", 120, LT400, "LNN Połaniec–Rzeszów 400kV T1"),
        LineConfig("Połaniec 400kV", "Rzeszów 400kV", 120, LT400, "LNN Połaniec–Rzeszów 400kV T2"),

        # Południe (dwutorowe - Śląsk + Turów)
        LineConfig("Kopanina 400kV", "Turów 400kV", 145, LT400, "LNN Kopanina–Turów 400kV T1"),
        LineConfig("Kopanina 400kV", "Turów 400kV", 145, LT400, "LNN Kopanina–Turów 400kV T2"),
        LineConfig("Turów 400kV", "Byczyna 400kV", 180, LT400, "LNN Turów–Byczyna 400kV T1"),
        LineConfig("Turów 400kV", "Byczyna 400kV", 180, LT400, "LNN Turów–Byczyna 400kV T2"),
        LineConfig("Kopanina 400kV", "Połaniec 400kV", 200, LT400, "LNN Kopanina–Połaniec 400kV T1"),
        LineConfig("Kopanina 400kV", "Połaniec 400kV", 200, LT400, "LNN Kopanina–Połaniec 400kV T2"),
    ]

    LINES_220KV: list[LineConfig] = [
        LineConfig("Gdańsk I 220kV",            "Żydowo 220kV",             120, LT220, "LNN Gdańsk–Żydowo 220kV"),
        LineConfig("Żydowo 220kV",              "Czerwonak 220kV",          190, LT220, "LNN Żydowo–Czerwonak 220kV"),
        LineConfig("Czerwonak 220kV",           "Pątnów 220kV",             100, LT220, "LNN Czerwonak–Pątnów 220kV"),
        LineConfig("Czerwonak 220kV",           "Pątnów 220kV",             102, LT220, "LNN Czerwonak–Pątnów 220kV T2"),
        LineConfig("Pątnów 220kV",              "Łódź Chocianowicka 220kV",  95, LT220, "LNN Pątnów–Łódź 220kV"),
        LineConfig("Pątnów 220kV",              "Łódź Chocianowicka 220kV",  95, LT220, "LNN Pątnów–Łódź 220kV T2"),
        LineConfig("Łódź Chocianowicka 220kV",  "Dobrzeń 220kV",            135, LT220, "LNN Łódź–Dobrzeń 220kV"),
        LineConfig("Dobrzeń 220kV",             "Pątnów 220kV",             110, LT220, "LNN Dobrzeń–Pątnów 220kV"),
        LineConfig("Dobrzeń 220kV",             "Blachownia 220kV",          40, LT220, "LNN Dobrzeń–Blachownia 220kV"),
        LineConfig("Blachownia 220kV",          "Klikowa 220kV",            100, LT220, "LNN Blachownia–Klikowa 220kV"),
        LineConfig("Klikowa 220kV",             "Chmielów 220kV",            80, LT220, "LNN Klikowa–Chmielów 220kV"),
        LineConfig("Chmielów 220kV",            "Stalowa Wola 220kV",        55, LT220, "LNN Chmielów–Stalowa Wola 220kV"),
        LineConfig("Stalowa Wola 220kV",        "Lubocza 220kV",            100, LT220, "LNN Stalowa Wola–Lubocza 220kV"),
        LineConfig("Radom 220kV",               "Lubocza 220kV",            165, LT220, "LNN Radom–Lubocza 220kV"),
        LineConfig("Wrocław 220kV",             "Dobrzeń 220kV",             80, LT220, "LNN Wrocław–Dobrzeń 220kV"),
        LineConfig("Wrocław 220kV",             "Czerwonak 220kV",          155, LT220, "LNN Wrocław–Czerwonak 220kV"),
        #LineConfig("Adamów 400kV", "Pątnów 220kV", 40, LT220, "Łącznik Adamów-Pątnów (blokowy)") # Uproszczenie modelowe
    ]

    TRAFOS: list[TrafoConfig] = [
        # Byczyna/Wrocław – tu musimy mieć 2 jednostki (standard N-1)
        TrafoConfig("Byczyna 400kV", "Wrocław 220kV",               AT, "AT Byczyna/Wrocław 400/220 T1"),
        TrafoConfig("Byczyna 400kV", "Wrocław 220kV",               AT, "AT Byczyna/Wrocław 400/220 T2"),
        TrafoConfig("Byczyna 400kV", "Wrocław 220kV",               AT, "AT Byczyna/Wrocław 400/220 T3"),
        TrafoConfig("Plewiska 400kV", "Czerwonak 220kV",            AT, "AT Plewiska/Czerwonak 400/220"),
        TrafoConfig("Byczyna 400kV", "Dobrzeń 220kV",               AT, "AT Byczyna/Dobrzeń 400/220"),
        TrafoConfig("Kopanina 400kV", "Blachownia 220kV",           AT, "AT Kopanina/Blachownia 400/220"),
        TrafoConfig("Połaniec 400kV", "Chmielów 220kV",             AT, "AT Połaniec/Chmielów 400/220"),
        TrafoConfig("Rzeszów 400kV", "Lubocza 220kV",               AT, "AT Rzeszów/Lubocza 400/220"),
        TrafoConfig("Gdańsk Błonia 400kV", "Gdańsk I 220kV",        AT, "AT Gdańsk 400/220"),
        TrafoConfig("Dunowo 400kV", "Żydowo 220kV",                 AT, "AT Dunowo/Żydowo 400/220"),
        TrafoConfig("Kozienice 400kV", "Radom 220kV",               AT, "AT Kozienice/Radom 400/220"),
        TrafoConfig("Lublin Systemowa 400kV", "Stalowa Wola 220kV", AT, "AT Lublin/Stalowa Wola 400/220"),
        TrafoConfig("Rogowiec 400kV", "Pątnów 220kV",               AT, "AT Rogowiec/Pątnów 400/220 T1"),
        TrafoConfig("Rogowiec 400kV", "Pątnów 220kV",               AT, "AT Rogowiec/Pątnów 400/220 T2"),
        TrafoConfig("Rogowiec 400kV", "Pątnów 220kV",               AT, "AT Rogowiec/Pątnów 400/220 T3"),
    ]

    GENERATORS: list[GenConfig] = [
        # Połaniec - realna moc bloku 400kV
        GenConfig("Połaniec 400kV", p_mw=1800, vm_pu=1.02, name="EL Połaniec", max_p_mw=1880, max_q_mvar=900, min_q_mvar=-500),
        # Turów - stabilne zasilanie południowego-zachodu
        GenConfig("Turów 400kV", p_mw=2000, vm_pu=1.02, name="EL Turów", max_p_mw=2000, max_q_mvar=1200, min_q_mvar=-1200),
        # Bełchatów - serce systemu, podbijamy napięcie do 1.03
        GenConfig("Rogowiec 400kV", p_mw=4500, vm_pu=1.03, name="EL Bełchatów", max_p_mw=5100, max_q_mvar=2200, min_q_mvar=-2000),
        # Adamów/Pątnów - zostawiamy TYLKO na 220kV (to zasili Łódź i Konin)
        # Usuwamy wpis "Adamów 400kV" z Twojej listy
        GenConfig("Pątnów 220kV", p_mw=1200, vm_pu=1.03, name="EL Adamów/Pątnów", max_p_mw=1400, max_q_mvar=1000, min_q_mvar=-500),
        # Pozostałe jednostki
        GenConfig("Żarnowiec 400kV", p_mw=500, vm_pu=1.02, name="EL Żarnowiec PSP", max_p_mw=716, min_p_mw=-716, max_q_mvar=430, min_q_mvar=-430),
        GenConfig("Żydowo 220kV", p_mw=150, vm_pu=1.02, name="EL Żydowo PSP", max_p_mw=150, min_p_mw=-150, max_q_mvar=90, min_q_mvar=-90),
        GenConfig("Stalowa Wola 220kV", p_mw=450, vm_pu=1.02, name="CCGT Stalowa Wola", max_p_mw=450, max_q_mvar=180, min_q_mvar=-180),
        GenConfig("Blachownia 220kV", p_mw=800, vm_pu=1.02, name="EL Blachownia", max_p_mw=800, max_q_mvar=480, min_q_mvar=-480),
        # Interkonektory - trzymają 1.00 pu na granicy
        GenConfig("Krajnik 400kV", p_mw=800, vm_pu=1.00, name="Interconnect DE→PL", max_p_mw=1000, max_q_mvar=400, min_q_mvar=-400),
        GenConfig("Plewiska 400kV", p_mw=900, vm_pu=1.00, name="Import SwePol+DE", max_p_mw=1500, max_q_mvar=450, min_q_mvar=-450),
    ]

    # cos φ ≈ 0.97 na szynach przesyłowych (po kompensacji DSO)
    LOADS: list[LoadConfig] = [
        LoadConfig("Gdańsk Błonia 400kV",      p_mw=1200, q_mvar=300,  name="Obszar Trójmiasto"),
        LoadConfig("Bydgoszcz Zachód 400kV",   p_mw=700,  q_mvar=175,  name="Obszar Bydgoszcz"),
        LoadConfig("Plewiska 400kV",            p_mw=1500, q_mvar=375,  name="Obszar Poznań"),
        # Warszawa rozłożona realnie: wiele wejść 400kV do aglomeracji
        LoadConfig("Warszawa Wschód 400kV",    p_mw=2000, q_mvar=500,  name="Obszar Warszawa Wschód"),
        LoadConfig("Miłosna 400kV",            p_mw=1500, q_mvar=375,  name="Obszar Warszawa Miłosna"),
        LoadConfig("Siedlce Ujrzanów 400kV",   p_mw=400,  q_mvar=100,  name="Obszar Siedlce/Wschód"),
        LoadConfig("Lublin Systemowa 400kV",   p_mw=800,  q_mvar=200,  name="Obszar Lublin"),
        LoadConfig("Rzeszów 400kV",             p_mw=700,  q_mvar=175,  name="Obszar Rzeszów"),
        LoadConfig("Kopanina 400kV",            p_mw=3000, q_mvar=750,  name="Obszar Śląsk"),
        LoadConfig("Wrocław 220kV",             p_mw=1600, q_mvar=400,  name="Obszar Wrocław"),
        LoadConfig("Łódź Chocianowicka 220kV",  p_mw=1400, q_mvar=350,  name="Obszar Łódź"),
        LoadConfig("Radom 220kV",               p_mw=500,  q_mvar=125,  name="Obszar Radom"),
        LoadConfig("Czerwonak 220kV",           p_mw=400,  q_mvar=100,  name="Obszar Czerwonak"),
        LoadConfig("Pątnów 220kV",              p_mw=600,  q_mvar=150,  name="Obszar Konin/Pątnów"),
        LoadConfig("Krajnik 400kV",             p_mw=300,  q_mvar=75,   name="Obszar Krajnik/Zachód"),
    ]
    # Suma P: 16600 MW (bez zmian), suma Q: ~4150 MVAr

    # Kompensacja reaktywna – cel: netto Q ≈ 0 przy pełnym obciążeniu
    # Linie 400 kV generują ~1500 MVAr, generatory dostarczają resztę
    # Netto Q obciążeń = 4150 MVAr → kompensacja shuntami ≈ 2500 MVAr pojemnościowych
    SHUNTS: list[ShuntConfig] = [
        # Szyny 400 kV – umiarkowana kompensacja (nie przesadzać, bo vmax rośnie)
        ShuntConfig("Gdańsk Błonia 400kV",     q_mvar=-150, name="BK Gdańsk"),
        ShuntConfig("Kopanina 400kV",          q_mvar=-300, name="BK Kopanina"),
        ShuntConfig("Lublin Systemowa 400kV",  q_mvar=-150, name="BK Lublin"),
        ShuntConfig("Rzeszów 400kV",           q_mvar=-120, name="BK Rzeszów"),
        ShuntConfig("Miłosna 400kV",           q_mvar=-200, name="BK Miłosna"),
        ShuntConfig("Kozienice 400kV",         q_mvar=-150, name="BK Kozienice"),
        ShuntConfig("Plewiska 400kV",          q_mvar=-150, name="BK Plewiska"),
        ShuntConfig("Bydgoszcz Zachód 400kV",  q_mvar=-120, name="BK Bydgoszcz"),
        ShuntConfig("Połaniec 400kV",          q_mvar=-120, name="BK Połaniec"),
        ShuntConfig("Adamów 400kV",            q_mvar=-120, name="BK Adamów"),
        ShuntConfig("Warszawa Wschód 400kV",   q_mvar=-250, name="BK Warszawa"),
        ShuntConfig("Rogowiec 400kV",          q_mvar=-100, name="BK Rogowiec"),
        ShuntConfig("Siedlce Ujrzanów 400kV",  q_mvar=-80,  name="BK Siedlce"),
        ShuntConfig("Turów 400kV",             q_mvar=-80,  name="BK Turów"),
        # Szyny 220 kV – mocna kompensacja lokalna (tu napięcia spadają najszybciej)
        ShuntConfig("Wrocław 220kV",            q_mvar=-400, name="BK Wrocław"),
        ShuntConfig("Łódź Chocianowicka 220kV", q_mvar=-600, name="BK Łódź"),
        ShuntConfig("Blachownia 220kV",         q_mvar=-150, name="BK Blachownia"),
        ShuntConfig("Stalowa Wola 220kV",       q_mvar=-120, name="BK Stalowa Wola"),
        ShuntConfig("Radom 220kV",              q_mvar=-100, name="BK Radom"),
        ShuntConfig("Czerwonak 220kV",          q_mvar=-100, name="BK Czerwonak"),
        ShuntConfig("Pątnów 220kV",             q_mvar=-100, name="BK Pątnów"),
        ShuntConfig("Żydowo 220kV",             q_mvar=-60,  name="BK Żydowo"),
        # Reaktory w węzłach tranzytowych – stabilizują Jacobian
        ShuntConfig("Dunowo 400kV",            q_mvar=50,   name="Reaktor Dunowo"),
        ShuntConfig("Byczyna 400kV",           q_mvar=50,   name="Reaktor Byczyna"),
        ShuntConfig("Gdańsk I 220kV",          q_mvar=30,   name="Reaktor Gdańsk I"),
        ShuntConfig("Dobrzeń 220kV",           q_mvar=30,   name="Reaktor Dobrzeń"),
        ShuntConfig("Klikowa 220kV",           q_mvar=30,   name="Reaktor Klikowa"),
        ShuntConfig("Lubocza 220kV",           q_mvar=30,   name="Reaktor Lubocza"),
        ShuntConfig("Chmielów 220kV",          q_mvar=30,   name="Reaktor Chmielów"),
    ]
    # Suma kompensacji pojemnościowej: ~2820 MVAr
    # Q netto: 4150 - 2820 - 190 (reaktory) - ~1500 (linie) ≈ -360 MVAr → generatory absorbują lekką nadwyżkę

    SLACK_BUS = "Kozienice 400kV"