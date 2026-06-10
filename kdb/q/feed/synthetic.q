/ Synthetic tick feed — publishes random OHLCV trade data to the tickerplant
/ Usage: q feed/synthetic.q <tp_host> <tp_port>

syms:`AAPL`GOOGL`MSFT`EURUSD`BTCUSD

midPx:`AAPL`GOOGL`MSFT`EURUSD`BTCUSD!185.0 175.0 420.0 1.085 67000.0

genTrade:{[s]
  px: midPx[s] * 1 + 0.001 * -1 + 2*rand 1f;
  midPx[s]:: px;
  sz: `long$ 100 + 100 * rand 10;
  side: `buy`sell rand 2;
  (.z.p; s; px; sz; side)
 }

/ use (host; port) tuple — works in all kdb+ 4.x versions
tpConn: `$":", .z.x[0], ":", .z.x[1]
tpHandle: 0N

.feed.connect:{[]
  while[tpHandle=0N;
    @[{tpHandle:: hopen x}; tpConn; {[e] system "sleep 1"}];
   ];
 }

.feed.connect[]

.z.ts:{
  ticks: genTrade each syms;
  t:([] time:`timestamp$ticks[;0]; sym:`symbol$ticks[;1]; price:`float$ticks[;2]; size:`long$ticks[;3]; side:`symbol$ticks[;4]);
  tpHandle (`.u.upd; `trade; t);
 }

\t 500
