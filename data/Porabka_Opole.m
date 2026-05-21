function mpc = Porabka_Opole_Urealniona
mpc.version = '2';
mpc.baseMVA = 100;

%% --- BUS DATA ---
% bus_i type Pd Qd Gs Bs area Vm Va baseKV zone Vmax Vmin
mpc.bus = [
    1  3   0   0   0  0   1  1.0  0  15.75 1  1.1  0.9;  % Szyna generatorowa ESP (SN) [Conversation]
    2  2   0   0   0  0   1  1.0  0  110   1  1.1  0.9;  % Rozdzielnia 110 kV (Regulacja) [91, Conversation]
    3  1   0   0   0  0   1  1.0  0  220   1  1.05 0.95; % Wyprowadzenie 220 kV (Bujaków) [2, 6]
    5  1   30.4 15 0  0   1  1.0  0  220   1  1.1  0.95; % Odbiór Opole-Dobrzeń 220 kV [2, 7]
];

%% --- GENERATOR DATA ---
% 4 jednostki po ok. 136 MW każda (łącznie 544 MW) [2, 8]
mpc.gen = [
    1  136  0  80  -60  1.0  100  1  138  0;
    1  136  0  80  -60  1.0  100  1  138  0;
    1  136  0  80  -60  1.0  100  1  138  0;
    1  136  0  80  -60  1.0  100  1  138  0;
];

%% --- BRANCH DATA ---
% fbus tbus r x b rateA rateB rateC tap shift status
mpc.branch = [
    % TRANSFORMACJA BLOKOWA (SN -> 110 kV)
    1  2  0.001  0.05  0  600  600  600  1.00  0  1; % [111, Conversation]

    % AUTOTRANSFORMATOR (110 -> 220 kV)
    2  3  0.001  0.06  0  600  600  600  1.00  0  1; % [91, Conversation]

    % LINIA 220 kV DO OPOLA (Trasa Bujaków-Dobrzeń)
    3  5  0.005  0.03  0.02 500  500  500  0     0  1; % [2, 7]
];