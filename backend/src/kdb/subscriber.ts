import { Connection } from 'node-q'
import { logger } from '../logger'
import { dispatcher } from '../ws/dispatcher'
import { queryHistory } from './queries'

const GRAN_MS: Record<string, number> = {
  '1m':  60_000,
  '5m':  300_000,
  '15m': 900_000,
  '1h':  3_600_000,
  '1d':  86_400_000,
}

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
      for (const granularity of dispatcher.granularitiesFor(sym)) {
        const granMs = GRAN_MS[granularity]
        if (!granMs) continue
        try {
          // aggregate from the current bar's true start so O/H/L cover the whole bar,
          // not just the last few seconds (JS epoch and kdb xbar boundaries coincide:
          // both are anchored at UTC midnight)
          const now = Date.now()
          const barStart = new Date(Math.floor(now / granMs) * granMs)
          const bars = await queryHistory(sym, granularity, barStart, new Date(now))
          if (bars.length > 0) {
            const last = bars[bars.length - 1]
            dispatcher.fanOut(sym, granularity, {
              t: last.time,
              o: last.open,
              h: last.high,
              l: last.low,
              c: last.close,
              v: last.volume,
            })
          }
        } catch (err) {
          logger.warn({ err, sym, granularity }, 'failed to aggregate candle after upd')
        }
      }
    }
  })
}
