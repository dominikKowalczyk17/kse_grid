function mpc = Zarnowiec
%% MATPOWER Case Format : Version 2
mpc.version = '2';

%%-----  Power Flow Data  -----%%
%% system MVA base
mpc.baseMVA = 100;

%% bus data
%	bus_i	type	Pd	Qd	Gs	Bs	area	Vm	Va	baseKV	zone	Vmax	Vmin	lam_P	lam_Q	mu_Vmax	mu_Vmin
mpc.bus = [
    206  3     0  0  0  0  1  1.00  0  400  5  1.05  0.95  105.9164  0.0017  0.0000  0.0000;
    187  1     0  0  0  0  1  1.00  0  400  5  1.05  0.95  105.1071  0.3094  0.0000  0.0000;
    195  1     0  0  0  0  1  1.00  0  400  5  1.05  0.95  104.9447  0.3712  0.0000  0.0000;
     18  2  18.4  0  0  0  1  1.00  0  400  1  1.11  0.95   97.2054  0.0000  0.0000  0.0000;
];

%% generator data
%	bus	Pg	Qg	Qmax	Qmin	Vg	mBase	status	Pmax	Pmin	Pc1	Pc2	Qc1min	Qc1max	Qc2min	Qc2max	ramp_agc	ramp_10	ramp_30	ramp_q	apf
mpc.gen = [
     18  0  0  450  -225  1.00  233.2  0  690  430  0  0  0  0  0  0  0  0  0  0  0    0.0000  15.5746  0.0000  0.0000;
    206  0  0  520  -320  1.00  196.1  1  716    0  0  0  0  0  0  0  0  0  0  0  0  105.9064   0.0000  0.0017  0.0000;
];

%% branch data
%	fbus	tbus	r	x	b	rateA	rateB	rateC	ratio	angle	status	angmin	angmax
mpc.branch = [
    187  206  0.00133  0.01569  0.418208   831   831   831  0  0  1  -360  360  261.3239  -36.3644  -260.4446    3.4173  0.0000  0.0000  0.0000  0.0000;
    195  187   0.0021  0.02475   0.65792  1358  1358  1358  0  0  1  -360  360   64.1234  -37.1325   -64.0400  -30.0894  0.0000  0.0000  0.0000  0.0000;
     18  195   0.0021  0.02475   0.65792  1358  1358  1358  0  0  1  -360  360   64.1234  -37.1325   -64.0400  -30.0894  0.0000  0.0000  0.0000  0.0000;
];

%%-----  OPF Data  -----%%
%% generator cost data
%	1	startup	shutdown	n	x1	y1	...	xn	yn
%	2	startup	shutdown	n	c(n-1)	...	c0
mpc.gencost = [
    2  0  0  3  0  112.78  0;
    2  0  0  3  0  112.78  0;
];
