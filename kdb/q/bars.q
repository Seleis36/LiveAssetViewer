\l schemas.q

/ Build OHLCV bars for a symbol over a time range.
/ gran: granularity in nanoseconds (long), supplied by the Express backend.
/ Returns empty bar table if no matching data.
buildBars:{[sym;gran;startTime;endTime]
  data:select from trade where sym=sym,time within (startTime;endTime);
  if[0=count data;:0#bar];
  select
    open:  first price,
    high:  max   price,
    low:   min   price,
    close: last  price,
    volume:sum   size
    by time:gran xbar time,sym
  from data
  }
