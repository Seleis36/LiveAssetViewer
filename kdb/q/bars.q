/ OHLCV candle aggregation
\l schemas.q

/ Map granularity string to nanoseconds
granToNs:{[gran]
  unit: last gran;
  n: "J"$ -1_gran;
  ns: `s`m`h`d!(`long$1e9; `long$60e9; `long$3600e9; `long$86400e9);
  n * ns[unit]
 }

/ Build OHLCV bars for a symbol over a time range
/ gran: granularity string e.g. "1m", "5m", "1h"
buildBars:{[sym;gran;startTime;endTime]
  data: select from trade where sym=sym, time within (startTime; endTime);
  gran_ns: granToNs gran;
  select
    open:  first price,
    high:  max   price,
    low:   min   price,
    close: last  price,
    volume: sum  size
    by time: gran_ns xbar time, sym
  from data
 }

/ Return list of available symbols from the trade table
getSymbols:{[] exec distinct sym from trade}
