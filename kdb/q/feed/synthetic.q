/ Synthetic tick feed — publishes random OHLCV trade data to the tickerplant
/ Usage: q feed/synthetic.q <tp_host> <tp_port>

syms:`AAPL`GOOGL`MSFT`EURUSD`BTCUSD

/ seed mid-prices
midPx:`AAPL`GOOGL`MSFT`EURUSD`BTCUSD!185.0 175.0 420.0 1.085 67000.0

/ generate a single random trade for symbol s
genTrade:{[s]
  px: midPx[s] * 1 + 0.001 * -1 + 2*rand 1f;
  midPx[s]:: px;
  sz: 100 + 100 * rand 10;
  side: `buy`sell rand 2;
  (`.z.p; s; px; sz; side)
 }

/ tickerplant connection details from command-line
tpAddr: `$":" sv .z.x 0 1
tpHandle: hopen tpAddr

/ publish one tick per symbol every 500ms
.z.ts:{
  ticks: genTrade each syms;
  cols: `time`sym`price`size`side;
  tpHandle (`.u.upd; `trade; flip cols!flip ticks);
 }

\t 500
