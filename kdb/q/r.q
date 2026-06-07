/ RDB — connects to tickerplant, subscribes to trade table, keeps today's data in memory
\l schemas.q
\l bars.q

/ tickerplant connection details from command-line: r.q <tp_host> <tp_port>
.rdb.tpHost: `$":" sv .z.x 0 1
.rdb.tpHandle: 0N

/ receive live updates from the tickerplant
.z.upd:{[t;x] t insert x}

/ reconnect to the tickerplant with exponential back-off
.rdb.reconnect:{[]
  delay: 1000;
  while[.rdb.tpHandle=0N;
    @[{.rdb.tpHandle: hopen x}; .rdb.tpHost; {delay: min[delay*2; 30000]}];
    if[.rdb.tpHandle=0N; system "sleep ", string ceiling delay % 1000];
   ];
  / subscribe to all syms on the trade table
  neg[.rdb.tpHandle] (`.u.sub; `trade; `);
 }

.rdb.reconnect[]

/ handle tickerplant disconnect
.z.pc:{[h] if[h=.rdb.tpHandle; .rdb.tpHandle:0N; .rdb.reconnect[]]}

\p 5011
