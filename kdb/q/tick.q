/ Tickerplant — receives upd calls from feeds, logs to disk, fans out to subscribers
\l schemas.q

/ subscriber registry: table -> list of (handle; syms) pairs
.u.w:(`trade`bar)!(();())

/ on-disk log file handle (opened when log dir arg is supplied)
.u.L:0N
.u.i:0

/ open the on-disk log for this day's data
.u.open:{[logdir]
  .u.L: hopen `$":" sv (string logdir; "tp_", string .z.d);
  .u.i: -11!(-2; .u.L);
 }

/ subscribe: caller handle, table name, syms (` means all)
.u.sub:{[t;s]
  h: .z.w;
  neg[h] (`snapshot; t; value t);
  .u.w[t]: .u.w[t], enlist (h; s);
 }

/ publish to all subscribers for a given table
.u.pub:{[t;x]
  {neg[first x] (`upd; t; y)} [; t; x] each .u.w[t];
 }

/ receive an update: insert, log, publish
.u.upd:{[t;x]
  t insert x;
  if[.u.L; .u.L enlist (`upd; t; x); .u.i+: 1];
  .u.pub[t; x];
 }

/ clean up disconnected clients
.z.pc:{h:.z.w; .u.w:{x where not (first each x)=h} each .u.w;}

if[1<count .z.x; .u.open `$.z.x 1]

\p 5010
