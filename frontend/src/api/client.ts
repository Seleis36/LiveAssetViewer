const BASE_URL = import.meta.env.VITE_API_URL ?? ''

export interface Symbol {
  sym: string
  description: string
}

export interface Candle {
  t: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

export async function fetchSymbols(): Promise<Symbol[]> {
  const res = await fetch(`${BASE_URL}/api/symbols`)
  if (!res.ok) throw new Error(`fetchSymbols: ${res.status}`)
  const data = await res.json()
  return data.symbols as Symbol[]
}

export async function fetchHistory(
  sym: string,
  granularity: string,
  from?: string,
  to?: string,
): Promise<Candle[]> {
  const params = new URLSearchParams({ granularity })
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const res = await fetch(`${BASE_URL}/api/history/${sym}?${params}`)
  if (!res.ok) throw new Error(`fetchHistory: ${res.status}`)
  const data = await res.json()
  return data.candles as Candle[]
}
