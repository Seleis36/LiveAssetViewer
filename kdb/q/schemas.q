// Canonical schema definitions — shared by all kdb+ processes
// US-04 will populate these with full table definitions

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
