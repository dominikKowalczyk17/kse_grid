function mpc = Porabka_Belchatow
%% MATPOWER Case Format : Version 2
%% Blackstart: ESP Porąbka-Żar → E Bełchatów (Rogowiec)
%% Trasa 220 kV: Porąbka-Żar – Bujaków – Byczyna – Tucznawa – Rogowiec
%% Źródło: 4×136 = 544 MW | Odbiór: Pw = 30,4 MW (1×380 MW, potrzeby własne)
mpc.version = '2';
mpc.baseMVA = 100;

%% bus data
%%  bus_i  type   Pd    Qd  Gs  Bs  area  Vm   Va  baseKV  zone  Vmax  Vmin
mpc.bus = [
    401  3     0   0  0  0  1  1.05  0  220  1  1.10  0.95;  % Porąbka-Żar (slack/ESP)
    402  1     0   0  0  0  1  1.00  0  220  1  1.10  0.95;  % Bujaków
    403  1     0   0  0  0  1  1.00  0  220  1  1.10  0.95;  % Byczyna
    404  1     0   0  0  0  1  1.00  0  220  1  1.10  0.95;  % Tucznawa
    405  1  30.4   0  0  0  1  1.00  0  220  1  1.10  0.95;  % Rogowiec/Bełchatów (Pw 1×380 MW)
];

%% generator data
%%  bus   Pg    Qg  Qmax  Qmin   Vg  mBase  status  Pmax  Pmin
mpc.gen = [
    401  136  0  100  -80  1.05  136  1  136  10;  % Hydro 1
    401  136  0  100  -80  1.05  136  1  136  10;  % Hydro 2
    401  136  0  100  -80  1.05  136  1  136  10;  % Hydro 3
    401  136  0  100  -80  1.05  136  1  136  10;  % Hydro 4
];

%% branch data  (220 kV AFL-400, Zbase = 484 Ω)
%%  fbus  tbus       r         x         b    rateA  rateB  rateC  ratio  angle  status
mpc.branch = [
    401  402  0.000356  0.004277  0.009151  550  550  550  0  0  1;  % 7 km
    402  403  0.001867  0.0224  0.047926  550  550  550  0  0  1;  % 36 km
    403  404  0.001236  0.014833  0.031736  550  550  550  0  0  1;  % 24 km
    404  405  0.005394  0.064728  0.138488  550  550  550  0  0  1;  % 104 km
];

%% generator cost data
mpc.gencost = [
    2  0  0  3  0  0  0;
    2  0  0  3  0  0  0;
    2  0  0  3  0  0  0;
    2  0  0  3  0  0  0;
];
