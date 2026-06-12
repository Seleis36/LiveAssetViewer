import { useConnectionStore } from '../stores/useConnectionStore'
import { useMarketStore } from '../stores/useMarketStore'
import type { Candle } from '../stores/useMarketStore'

const BASE_DELAY_MS = 500
const MAX_DELAY_MS = 30_000
const PING_INTERVAL_MS = 30_000

interface WsMessage {
  type: string
  [key: string]: unknown
}

class WsClient {
  private ws: WebSocket | null = null
  private symbol: string | null = null
  private granularity = '1m'
  private delay = BASE_DELAY_MS
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  connect(wsUrl: string): void {
    this.destroyed = false
    useConnectionStore.getState().setStatus('connecting')

    const sock = new WebSocket(wsUrl)
    this.ws = sock

    sock.onopen = () => {
      if (this.ws !== sock) return
      this.delay = BASE_DELAY_MS
      useConnectionStore.getState().setStatus('open')
      if (this.symbol) this.sendSubscribe()
      this.startPing()
    }

    sock.onmessage = (evt) => {
      if (this.ws !== sock) return
      let msg: WsMessage
      try { msg = JSON.parse(evt.data as string) } catch { return }
      this.handle(msg)
    }

    sock.onerror = () => {
      if (this.ws !== sock) return
      useConnectionStore.getState().setStatus('error')
    }

    sock.onclose = () => {
      // a superseded socket (StrictMode remount, manual reconnect) must not
      // touch state or schedule reconnects — only the current one may
      if (this.ws !== sock) return
      this.stopPing()
      if (this.destroyed) return
      useConnectionStore.getState().setStatus('closed')
      this.scheduleReconnect(wsUrl)
    }
  }

  subscribe(symbol: string, granularity: string): void {
    this.symbol = symbol
    this.granularity = granularity
    if (this.ws?.readyState === WebSocket.OPEN) this.sendSubscribe()
  }

  destroy(): void {
    this.destroyed = true
    this.stopPing()
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
  }

  private sendSubscribe(): void {
    this.ws!.send(JSON.stringify({ type: 'subscribe', symbol: this.symbol, granularity: this.granularity }))
  }

  private handle(msg: WsMessage): void {
    const store = useMarketStore.getState()
    if (msg.type === 'snapshot') {
      if (msg.sym !== this.symbol) return
      store.pushCandles(msg.candles as Candle[])
    } else if (msg.type === 'candle_update') {
      // drop updates from a previous subscription still in flight
      if (msg.sym !== this.symbol) return
      if (msg.granularity && msg.granularity !== this.granularity) return
      store.updateLastCandle(msg.candle as Candle)
    }
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }))
      }
    }, PING_INTERVAL_MS)
  }

  private stopPing(): void {
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null }
  }

  private scheduleReconnect(wsUrl: string): void {
    this.reconnectTimer = setTimeout(() => {
      this.delay = Math.min(this.delay * 2, MAX_DELAY_MS)
      this.connect(wsUrl)
    }, this.delay)
  }
}

export const wsClient = new WsClient()
