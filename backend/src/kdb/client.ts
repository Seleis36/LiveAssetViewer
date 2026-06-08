import q, { Connection } from 'node-q'
import { config } from '../config'
import { logger } from '../logger'

let connection: Connection | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
const KEEPALIVE_INTERVAL_MS = 15_000
const MAX_BACKOFF_MS = 30_000

function connectCb(attempt: number): void {
  q.connect({ host: config.kdb.host, port: config.kdb.port }, (err, conn) => {
    if (err || !conn) {
      const backoff = Math.min(500 * 2 ** attempt, MAX_BACKOFF_MS)
      logger.warn({ err, backoff }, 'kdb+ connection failed, retrying')
      scheduleReconnect(attempt + 1, backoff)
      return
    }

    connection = conn
    logger.info({ host: config.kdb.host, port: config.kdb.port }, 'kdb+ connected')
    notifyConnected(conn)

    conn.on('error', (connErr) => {
      logger.warn({ err: connErr }, 'kdb+ connection error, reconnecting')
      connection = null
      scheduleReconnect(0)
    })

    conn.on('close', () => {
      if (connection) {
        logger.warn('kdb+ connection closed, reconnecting')
        connection = null
        scheduleReconnect(0)
      }
    })

    setInterval(() => {
      conn.k('1b', (pingErr) => {
        if (pingErr) {
          logger.warn('kdb+ keepalive failed, reconnecting')
          connection = null
          scheduleReconnect(0)
        }
      })
    }, KEEPALIVE_INTERVAL_MS)
  })
}

function scheduleReconnect(attempt: number, delayMs = 500): void {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(() => connectCb(attempt), delayMs)
}

export function getKdbClient(): Connection {
  if (!connection) throw new Error('kdb+ not connected')
  return connection
}

export function isKdbConnected(): boolean {
  return connection !== null
}

type ConnectedCallback = (conn: Connection) => void
const onConnectCallbacks: ConnectedCallback[] = []

export function onKdbConnect(cb: ConnectedCallback): void {
  if (connection) { cb(connection); return }
  onConnectCallbacks.push(cb)
}

export function initKdb(): void {
  connectCb(0)
}

function notifyConnected(conn: Connection): void {
  for (const cb of onConnectCallbacks) cb(conn)
  onConnectCallbacks.length = 0
}
