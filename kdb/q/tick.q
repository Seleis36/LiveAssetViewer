/ Tickerplant — receives upd calls from feeds, logs to disk, fans out to subscribers
\l schemas.q

.u.w:(`trade`bar)!(();())
.u.L:0N
.u.i:0

.u.open:{[logdir]
  .u.L: hopen `$":", (string logdir), "/tp_", string .z.d;
  .u.i: 0;
 }

.u.sub:{[t;s]
  h: .z.w;
  .u.w[t]: .u.w[t], enlist (h; s);
 }

buildBars:{[sym;gran;startTime;endTime]
  gran: `long$ gran;
  data:select from trade where sym=sym,time within (startTime;endTime);
  if[0=count data;:0#bar];
  0! select open:first price,high:max price,low:min price,close:last price,volume:sum size
     by time:gran xbar time,sym
  from data
 }

/ explicit projection passes t and x into inner lambda — kdb+ has no closures
.u.pub:{[t;x]
  {[t;x;sub] neg[sub 0] (`upd; t; x)}[t;x;] each .u.w[t];
 }

.u.upd:{[t;x]
  t insert x;
  if[not null .u.L; .u.L enlist (`upd; t; x); .u.i+: 1];
  .u.pub[t; x];
 }

/ explicit projection passes h into inner lambda
.z.pc:{[h] .u.w: {[h;v] v where not (first each v)=h}[h;] each .u.w;}

/ wrap in error trap so a failed log open does not abort the script
if[1<count .z.x; @[.u.open; `$.z.x 1; {[e] -2 "warn: log open failed: ", string e}]];

-1 "TICK LOADED OK";
