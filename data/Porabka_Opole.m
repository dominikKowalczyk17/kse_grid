function mpc = Porabka_Opole
%% MATPOWER Case Format : Version 2
%% Blackstart: ESP Porąbka-Żar → E Opole (Dobrzeń)
%% Trasa 220 kV: Porąbka-Żar – Bujaków – Byczyna – Halemba – Kopanina – Wielopole – Dobrzeń
%% Źródło: 4×136 = 544 MW | Odbiór: Pw = 30,4 MW (1×380 MW, potrzeby własne)
mpc.version = '2';
mpc.baseMVA = 100;

%% bus data
%%  bus_i  type   Pd    Qd  Gs  Bs  area  Vm   Va  baseKV  zone  Vmax  Vmin
mpc.bus = [
    501  3     0  0  0  0  1  1.05  0  220  1  1.10  0.95;  % Porąbka-Żar (slack/ESP)
    502  1     0  0  0  0  1  1.00  0  220  1  1.10  0.95;  % Bujaków
    503  1     0  0  0  0  1  1.00  0  220  1  1.10  0.95;  % Byczyna
    504  1     0  0  0  0  1  1.00  0  220  1  1.10  0.95;  % Halemba
    505  1     0  0  0  0  1  1.00  0  220  1  1.10  0.95;  % Kopanina
    506  1     0  0  0  0  1  1.00  0  220  1  1.10  0.95;  % Wielopole
    507  1  30.4  0  0  0  1  1.00  0  220  1  1.10  0.95;  % Dobrzeń/Opole (Pw 1×380 MW)
];

%% generator data
%%  bus   Pg    Qg  Qmax  Qmin   Vg  mBase  status  Pmax  Pmin
mpc.gen = [
    501  136  0  100  -80  1.05  136  1  136  10;  % Hydro 1
    501  136  0  100  -80  1.05  136  1  136  10;  % Hydro 2
    501  136  0  100  -80  1.05  136  1  136  10;  % Hydro 3
    501  136  0  100  -80  1.05  136  1  136  10;  % Hydro 4
];

%% branch data  (220 kV AFL-400, Zbase = 484 Ω)
%%  fbus  tbus       r         x         b    rateA  rateB  rateC  ratio  angle  status
mpc.branch = [
    501  502  0.000356  0.004277  0.009151  550  550  550  0  0  1;  % 7 km
    502  503  0.001867    0.0224  0.047926  550  550  550  0  0  1;  % 36 km
    503  504  0.001671  0.020051    0.0429  550  550  550  0  0  1;  % 32 km
    504  505  0.000578  0.006939  0.014847  550  550  550  0  0  1;  % 11 km
    505  506  0.001144  0.013724  0.029363  550  550  550  0  0  1;  % 22 km
    506  507  0.004327   0.05192  0.111084  550  550  550  0  0  1;  % 84 km
];

%% generator cost data
mpc.gencost = [
    2  0  0  3  0  0  0;
    2  0  0  3  0  0  0;
    2  0  0  3  0  0  0;
    2  0  0  3  0  0  0;
];
