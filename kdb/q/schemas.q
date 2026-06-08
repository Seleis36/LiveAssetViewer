/ Canonical schema definitions shared by all kdb+ processes

trade:([]
  time:`timestamp$();
  sym:`symbol$();
  price:`float$();
  size:`long$();
  side:`symbol$()
)

bar:([]
  time:`timestamp$();
  sym:`symbol$();
  open:`float$();
  high:`float$();
  low:`float$();
  close:`float$();
  volume:`long$()
)

/ Static symbol reference table used by the backend /api/symbols endpoint
symbolRef:([]
  sym:   `AAPL`GOOGL`MSFT`EURUSD`BTCUSD;
  description: ("Apple Inc.";"Alphabet Inc.";"Microsoft Corp.";"Euro / US Dollar";"Bitcoin / US Dollar")
)
