import { WebSocketServer, WebSocket } from 'ws'
import { IncomingMessage, Server } from 'http'
import { logger } from '../logger'
import { dispatcher } from './dispatcher'

const PING_INTERVAL_MS = 30_000

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
        if (symbol) dispatcher.unsubscribe(symbol, ws)
        symbol = msg.symbol as string
        const granularity = (msg.granularity as string) ?? '1m'
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
