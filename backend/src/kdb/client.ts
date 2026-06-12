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

    // each event below may fire on a connection that has already been
    // replaced — only tear down if `conn` is still the active one
    const dropIfCurrent = (reason: string): void => {
      if (connection !== conn) return
      logger.warn(reason)
      connection = null
      clearInterval(keepalive)
      scheduleReconnect(0)
    }

    const keepalive = setInterval(() => {
      if (connection !== conn) { clearInterval(keepalive); return }
      conn.k('1b', (pingErr) => {
        if (pingErr) dropIfCurrent('kdb+ keepalive failed, reconnecting')
      })
    }, KEEPALIVE_INTERVAL_MS)

    conn.on('error', (connErr) => {
      logger.warn({ err: connErr }, 'kdb+ connection error')
      dropIfCurrent('kdb+ connection error, reconnecting')
    })

    conn.on('close', () => {
      clearInterval(keepalive)
      dropIfCurrent('kdb+ connection closed, reconnecting')
    })
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
  onConnectCallbacks.push(cb)
  if (connection) cb(connection)
}

export function initKdb(): void {
  connectCb(0)
}

function notifyConnected(conn: Connection): void {
  for (const cb of onConnectCallbacks) cb(conn)
}
