// Canonical schema definitions — shared by all kdb+ processes

trade:([]
  time:`timestamp$();
  sym:`symbol$();
  price:`float$();
  size:`long$();
  side:`symbol$()    / `buy or `sell
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

symbolRef:([]
  sym:`symbol$();
  description:`symbol$()
)
