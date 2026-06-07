\l schemas.q

// Granularity symbol to nanoseconds
granToNs:{[gran]
  map:`1m`5m`15m`1h`1d!60 300 900 3600 86400*1000000000j;
  if[not gran in key map;'"unsupported granularity: ",string gran];
  map gran
  }

// Aggregate raw trades into OHLCV candles
// sym       : `symbol
// gran      : `1m | `5m | `15m | `1h | `1d
// startTime : timestamp
// endTime   : timestamp
// returns   : bar table (empty bar schema if no data)
buildBars:{[sym;gran;startTime;endTime]
  gran_ns:granToNs gran;
  data:select from trade where sym=sym,time within (startTime;endTime);
  if[0=count data;:0#bar];
  select
    open:  first price,
    high:  max   price,
    low:   min   price,
    close: last  price,
    volume:sum   size
    by time:gran_ns xbar time,sym
  from data
  }
