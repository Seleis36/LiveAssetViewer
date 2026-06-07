import { WebSocket } from 'ws'
import { logger } from '../server'

interface Subscriber {
  ws: WebSocket
  granularity: string
}

class Dispatcher {
  private subs = new Map<string, Set<Subscriber>>()

  subscribe(symbol: string, granularity: string, ws: WebSocket): void {
    if (!this.subs.has(symbol)) this.subs.set(symbol, new Set())
    this.subs.get(symbol)!.add({ ws, granularity })
  }

  unsubscribe(symbol: string, ws: WebSocket): void {
    const set = this.subs.get(symbol)
    if (!set) return
    for (const sub of set) {
      if (sub.ws === ws) { set.delete(sub); break }
    }
    if (set.size === 0) this.subs.delete(symbol)
  }

  fanOut(table: string, data: unknown[]): void {
    if (table !== 'trade') return
    for (const row of data as Array<Record<string, unknown>>) {
      const sym = row['sym'] as string
      const set = this.subs.get(sym)
      if (!set || set.size === 0) continue
      const candle = {
        t: row['time'],
        o: row['open'] ?? row['price'],
        h: row['high'] ?? row['price'],
        l: row['low'] ?? row['price'],
        c: row['close'] ?? row['price'],
        v: row['volume'] ?? row['size'],
      }
      const msg = JSON.stringify({ type: 'candle_update', sym, candle })
      for (const sub of set) {
        if (sub.ws.readyState === WebSocket.OPEN) {
          sub.ws.send(msg, (err) => {
            if (err) logger.error({ err, sym }, 'ws send error')
          })
        }
      }
    }
  }

  activeCount(): number {
    let n = 0
    for (const set of this.subs.values()) n += set.size
    return n
  }
}

export const dispatcher = new Dispatcher()
