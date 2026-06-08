import { WebSocket } from 'ws'
import { logger } from '../logger'

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

  fanOut(sym: string, candle: Record<string, unknown>): void {
    const set = this.subs.get(sym)
    if (!set || set.size === 0) return
    const msg = JSON.stringify({ type: 'candle_update', sym, candle })
    for (const sub of set) {
      if (sub.ws.readyState === WebSocket.OPEN) {
        sub.ws.send(msg, (err) => {
          if (err) logger.error({ err, sym }, 'ws send error')
        })
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
