/ RDB — connects to tickerplant, subscribes to trade table, keeps today's data in memory
\l schemas.q
\l bars.q

/ hopen needs the `$":host:port" symbol form — the (host; port) tuple throws 'type here
.rdb.tpConn: `$":", .z.x[0], ":", .z.x[1]
.rdb.tpHandle: 0N
.rdb.delay: 1000

/ the TP publishes async calls to global `upd` — define both forms
upd:{[t;x] t insert x}
.z.upd: upd

.rdb.reconnect:{[]
  .rdb.delay: 1000;
  while[.rdb.tpHandle=0N;
    @[{.rdb.tpHandle: hopen x}; .rdb.tpConn; {[e] .rdb.delay: (.rdb.delay*2) & 30000}];
    if[.rdb.tpHandle=0N; system "sleep ", string ceiling .rdb.delay % 1000];
   ];
  neg[.rdb.tpHandle] (`.u.sub; `trade; `);
 }

.rdb.reconnect[]

.z.pc:{[h] if[h=.rdb.tpHandle; .rdb.tpHandle:0N; .rdb.reconnect[]]}
