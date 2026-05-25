function mpc = Ostroleka
%% MATPOWER Case Format : Version 2
mpc.version = '2';

%%-----  Power Flow Data  -----%%
%% system MVA base
mpc.baseMVA = 100;

%% bus data
%	bus_i	type	Pd	Qd	Gs	Bs	area	Vm	Va	baseKV	zone	Vmax	Vmin	lam_P	lam_Q	mu_Vmax	mu_Vmin
mpc.bus = [
    1  3   0  0  0  0  1  1.00  0   15  2  1.12  0.95   98.1266  -0.3436  0.0000  0.0000;  %Szyna generatorowa Żarnowiec (15kV)
    2  1   0  0  0  0  1  1.00  0  400  5  1.05  0.95  105.9164   0.0017  0.0000  0.0000;  %Wyprowadzenie mocy z Żarnowca (400kV)
    3  1   0  0  0  0  1  1.00  0  400  5  1.05  0.95  105.1071   0.3094  0.0000  0.0000;  %Gdańsk błonia
    4  1   0  0  0  0  1  1.00  0  400  5  1.05  0.95  104.9447   0.3712  0.0000  0.0000;  %Olsztyn
    5  1   0  0  0  0  1  1.00  0  400  1  1.11  0.95   97.2054   0.0000  0.0000  0.0000;  %Ostrołęka - wejście mocy (400kV)
    6  1  17  8  0  0  1  1.00  0   22  2  1.05  0.95   94.5600  -0.5862  0.0000  0.0000;  %Szyna generatorowa/potrzeby własne Ostrołeka (22kV)
];

%% generator data
%	bus	Pg	Qg	Qmax	Qmin	Vg	mBase	status	Pmax	Pmin	Pc1	Pc2	Qc1min	Qc1max	Qc2min	Qc2max	ramp_agc	ramp_10	ramp_30	ramp_q	apf
mpc.gen = [
    2  0  0  450  -225  1.00  233.2  0  690  430  0  0  0  0  0  0  0  0  0  0  0    0.0000  15.5746  0.0000  0.0000;
    1  0  0  520  -320  1.00  196.1  1  716    0  0  0  0  0  0  0  0  0  0  0  0  105.9064   0.0000  0.0017  0.0000;
];

%% branch data
%	fbus	tbus	r	x	b	rateA	rateB	rateC	ratio	angle	status	angmin	angmax
mpc.branch = [
    1  2  0.00105  0.06143  0.00   173   173   173  1.00  0  1  -360  360  -23.2693   21.5026    23.2818  -20.9415  0.0000  0.0000  0.0000  0.0000;
    2  3  0.00133  0.01569  0.42   831   831   831     0  0  1  -360  360  261.3239  -36.3644  -260.4446    3.4173  0.0000  0.0000  0.0000  0.0000;
    3  4   0.0021  0.02475  0.66  1358  1358  1358     0  0  1  -360  360   64.1234  -37.1325   -64.0400  -30.0894  0.0000  0.0000  0.0000  0.0000;
    4  5   0.0021  0.02475  0.66  1358  1358  1358     0  0  1  -360  360   64.1234  -37.1325   -64.0400  -30.0894  0.0000  0.0000  0.0000  0.0000;
    5  6  0.00094  0.05876  0.00  1358  1358  1358  1.00  0  1  -360  360  -62.6245   -4.9449    62.6996  -55.5314  0.0000  0.0000  0.0000  0.0000;
];

%%-----  OPF Data  -----%%
%% generator cost data
%	1	startup	shutdown	n	x1	y1	...	xn	yn
%	2	startup	shutdown	n	c(n-1)	...	c0
mpc.gencost = [
    2  0  0  3  0  112.78  0;
    2  0  0  3  0  112.78  0;
];
