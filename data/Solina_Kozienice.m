function mpc = Solina_Kozienice
%% MATPOWER Case Format : Version 2
mpc.version = '2';
mpc.baseMVA = 100; %% Moc bazowa systemu [1]

%% --- BUS DATA ---
% Typy: 3=Slack (Solina), 2=PV, 1=PQ (Odbiór) [3, 4]
%% bus_i type Pd Qd Gs Bs area Vm Va baseKV zone Vmax Vmin
mpc.bus = [
    1  3   0   0  0  0  1  1.0  0  10.5  1   1.1   0.9;  % Szyna generatorowa Solina (SN)
    2  1   0   0  0  0  1  1.0  0   110  1   1.1   0.9;  % Wyprowadzenie Solina 110 kV
    3  1   0   0  0  0  1  1.0  0   400  1  1.05  0.95;  % Stacja Iskrzynia (400 kV)
    4  1   0   0  0  0  1  1.0  0   400  1  1.05  0.95;  % Tranzyt
    5  1   0   0  0  0  1  1.0  0   400  1  1.05  0.95;  % Kozienice 400 kV
    6  1  25  15  0  0  1  1.0  0   220  1   1.1  0.95;  % Potrzeby własne Kozienice 220 kV
];

%% --- GENERATOR DATA ---
%% bus Pg Qg Qmax Qmin Vg mBase status Pmax Pmin
% Zdefiniowano 4 jednostki w Solinie (Węzeł Slack)
mpc.gen = [
    1  35  0  60  -50  1.0  100  1  68.7  0;  % Hydro 1
    1  35  0  60  -50  1.0  100  1  68.7  0;  % Hydro 2
    1  15  0  30  -25  1.0  100  1  30.0  0;  % Hydro 3
    1  15  0  30  -25  1.0  100  1  30.0  0;  % Hydro 4
];

%% --- BRANCH DATA ---
% tap = 0 dla linii, tap > 0 dla transformatorów [5, 6]
%% fbus tbus r x b rateA rateB rateC tap shift status
mpc.branch = [
    1  2  0.001  0.05     0   200   200   200  1.00  0  1;
    2  3  0.001  0.06     0   500   500   500  1.00  0  1;
    3  4  0.002  0.02  0.05  1500  1500  1500     0  0  1;  % Odcinek 1 (ok. 100 km)
    4  5  0.002  0.02  0.05  1500  1500  1500     0  0  1;  % Odcinek 2 (ok. 100 km)
    5  6  0.001  0.04     0   500   500   500  1.00  0  1;
];

%% --- COST DATA (Opcjonalne dla runopf) ---
mpc.gencost = [
    2  0  0  3  0.01  20  0;
    2  0  0  3  0.01  20  0;
    2  0  0  3  0.01  20  0;
    2  0  0  3  0.01  20  0;
];