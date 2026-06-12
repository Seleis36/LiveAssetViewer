import { getKdbClient } from './client'

export interface KdbSymbol {
  sym: string
  description: string
}

export interface KdbBar {
  time: Date
  sym: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const GRAN_MAP: Record<string, number> = {
  '1m':  60_000_000_000,
  '5m':  300_000_000_000,
  '15m': 900_000_000_000,
  '1h':  3_600_000_000_000,
  '1d':  86_400_000_000_000,
}

function kQuery<T>(statement: string, ...params: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const client = getKdbClient()
    const args: unknown[] = [statement, ...params, (err: Error | undefined, result: T | undefined) => {
      if (err) return reject(err)
      resolve(result as T)
    }]
    client.k(...(args as Parameters<typeof client.k>))
  })
}

export function querySymbols(): Promise<KdbSymbol[]> {
  return kQuery<KdbSymbol[]>('select sym, description from symbolRef')
}

export async function queryHistory(
  sym: string,
  granularity: string,
  from: Date,
  to: Date,
): Promise<KdbBar[]> {
  const gran = GRAN_MAP[granularity]
  if (!gran) throw new Error(`Unsupported granularity: ${granularity}`)
  const bars = await kQuery<KdbBar[]>('buildBars', sym, gran, from, to)
  // node-q deserializes kdb's int64 nanosecond timestamps through a float64,
  // so exact bar boundaries can come back 1ms early (e.g. 15:40:59.999).
  // Bars are always second-aligned — round to the nearest second.
  return bars.map((b) => ({
    ...b,
    time: new Date(Math.round(b.time.getTime() / 1000) * 1000),
  }))
}
