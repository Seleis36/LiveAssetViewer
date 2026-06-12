import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage, Server } from 'http'
import { logger } from '../logger'
import { dispatcher } from './dispatcher'

const PING_INTERVAL_MS = 30_000
const VALID_GRANULARITIES = new Set(['1m', '5m', '15m', '1h', '1d'])

export function attachWsServer(httpServer: Server): void {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const ip = req.socket.remoteAddress
    logger.info({ ip }, 'ws connected')

    let symbol: string | null = null
    let alive = true

    const pingTimer = setInterval(() => {
      if (!alive) { ws.terminate(); return }
      alive = false
      ws.ping()
    }, PING_INTERVAL_MS)

    ws.on('pong', () => { alive = true })

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        ws.send(JSON.stringify({ type: 'error', code: 'BAD_JSON', message: 'Invalid JSON' }))
        return
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', ts: msg.ts }))
        return
      }

      if (msg.type === 'subscribe') {
        const granularity = (msg.granularity as string) ?? '1m'
        if (typeof msg.symbol !== 'string' || msg.symbol.length === 0 || !VALID_GRANULARITIES.has(granularity)) {
          ws.send(JSON.stringify({ type: 'error', code: 'BAD_SUBSCRIBE', message: 'symbol must be a non-empty string and granularity one of 1m,5m,15m,1h,1d' }))
          return
        }
        if (symbol) dispatcher.unsubscribe(symbol, ws)
        symbol = msg.symbol
        dispatcher.subscribe(symbol, granularity, ws)
        logger.info({ symbol, granularity }, 'ws subscribe')
        return
      }

      if (msg.type === 'unsubscribe') {
        if (symbol) { dispatcher.unsubscribe(symbol, ws); symbol = null }
        return
      }
    })

    ws.on('close', () => {
      clearInterval(pingTimer)
      if (symbol) dispatcher.unsubscribe(symbol, ws)
      logger.info({ ip }, 'ws disconnected')
    })

    ws.on('error', (err) => logger.error({ err }, 'ws error'))
  })
}
