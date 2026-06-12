\l schemas.q

/ Build OHLCV bars for a symbol over a time range.
/ gran: granularity in nanoseconds (long), supplied by the Express backend.
/ Returns empty bar table if no matching data.
/ NB: param must not be named `sym` — inside q-sql the column shadows it
/ and `where sym=sym` matches every row.
buildBars:{[s;gran;startTime;endTime]
  s: $[10h=abs type s; `$s; s];  / node-q sends JS strings as char lists
  gran: `long$ gran;
  data:select from trade where sym=s,time within (startTime;endTime);
  if[0=count data;:0#bar];
  0! select
    open:  first price,
    high:  max   price,
    low:   min   price,
    close: last  price,
    volume:sum   size
    by time:gran xbar time,sym
  from data
  }
