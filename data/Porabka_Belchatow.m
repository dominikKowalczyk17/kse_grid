function mpc = Porabka_Belchatow_Urealniona
%% MATPOWER Case Format : Version 2
%% Blackstart: ESP Porąbka-Żar → E Bełchatów (Rogowiec)
%% Trasa 220 kV: Porąbka (SN) -> Trafo (110) -> Bujaków (220) -> Byczyna -> Tucznawa -> Rogowiec
mpc.version = '2';
mpc.baseMVA = 100;

%% --- BUS DATA ---
% bus_i type Pd Qd Gs Bs area Vm Va baseKV zone Vmax Vmin
mpc.bus = [
    1  3   0   0   0  0   1  1.05  0  15.75 1  1.1  0.95; % Szyna generatorowa ESP (SN) [1]
    2  2   0   0   0  0   1  1.03  0  110   1  1.1  0.95; % Rozdzielnia 110 kV (Punkt regulacji) [2]
    3  1   0   0   0  0   1  1.00  0  220   1  1.1  0.95; % Bujaków (Wyprowadzenie 220 kV)
    4  1   0   0   0  0   1  1.00  0  220   1  1.1  0.95; % Byczyna (Tranzyt) [3]
    5  1   0   0   0  0   1  1.00  0  220   1  1.1  0.95; % Tucznawa (Tranzyt)
    6  1  30.4 15  0  0   1  1.00  0  220   1  1.1  0.95; % Rogowiec (Bełchatów - Pw bloku 380 MW) [4, 5]
];

%% --- GENERATOR DATA ---
% bus Pg Qg Qmax Qmin Vg mBase status Pmax Pmin
mpc.gen = [
    1  25  0  100  -80  1.05  136  1  136  10; % Hydro 1 (Moc Pg ustawiona pod rozruch) [6, 7]
    1  25  0  100  -80  1.05  136  1  136  10; % Hydro 2
    1  25  0  100  -80  1.05  136  1  136  10; % Hydro 3
    1  25  0  100  -80  1.05  136  1  136  10; % Hydro 4
];

%% --- BRANCH DATA ---
% fbus tbus r x b rateA rateB rateC tap shift status
mpc.branch = [
    % TRANSFORMACJA I POWIĄZANIA PRZY ELEKTROWNI
    1  2  0.001  0.05  0  600  600  600  1.00  0  1; % Trafo blokowe SN/110 kV [1, 8]
    2  3  0.001  0.06  0  600  600  600  1.00  0  1; % Autotransformator 110/220 kV

    % LINIE PRZESYŁOWE 220 kV (AFL-400) [Dane z Twojego szkicu]
    3  4  0.0018  0.022  0.047  550  550  550  0  0  1; % Bujaków - Byczyna (36 km)
    4  5  0.0012  0.014  0.031  550  550  550  0  0  1; % Byczyna - Tucznawa (24 km)
    5  6  0.0053  0.064  0.138  550  550  550  0  0  1; % Tucznawa - Rogowiec (104 km)
];

%% --- GENERATOR COST DATA ---
mpc.gencost = [
    2  0  0  3  0  0  0;
    2  0  0  3  0  0  0;
    2  0  0  3  0  0  0;
    2  0  0  3  0  0  0;
];