import { Connection } from 'node-q'
import { logger } from '../logger'
import { dispatcher } from '../ws/dispatcher'
import { queryHistory } from './queries'

const GRAN_NS = 60_000_000_000 // 1-minute default for live updates

export function startSubscriber(conn: Connection): void {
  conn.ks('.u.sub[`trade;`]', (err) => {
    if (err) {
      logger.error({ err }, 'kdb+ .u.sub failed')
      return
    }
    logger.info('subscribed to kdb+ tickerplant (trade)')
  })

  conn.on('upd', async (table: string, data: unknown) => {
    if (table !== 'trade') return

    const rows = Array.isArray(data) ? data : [data]
    const symsSeen = new Set<string>()

    for (const row of rows as Array<Record<string, unknown>>) {
      const sym = row['sym'] as string
      if (sym) symsSeen.add(sym)
    }

    for (const sym of symsSeen) {
      if (dispatcher.activeCount() === 0) continue
      try {
        const to = new Date()
        const from = new Date(to.getTime() - 60_000)
        const bars = await queryHistory(sym, '1m', from, to)
        if (bars.length > 0) {
          const last = bars[bars.length - 1]
          dispatcher.fanOut(sym, {
            t: last.time,
            o: last.open,
            h: last.high,
            l: last.low,
            c: last.close,
            v: last.volume,
          })
        }
      } catch (err) {
        logger.warn({ err, sym }, 'failed to aggregate candle after upd')
      }
    }
  })
}
