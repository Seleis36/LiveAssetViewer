import { Router, Request, Response } from 'express'
import { queryHistory } from '../kdb/queries'
import { logger } from '../logger'

const VALID_GRANULARITIES = new Set(['1m', '5m', '15m', '1h', '1d'])

const router = Router()

router.get('/api/history/:symbol', async (req: Request, res: Response) => {
  const symbol = req.params['symbol'] as string
  const { granularity, from, to } = req.query

  if (!granularity || typeof granularity !== 'string') {
    return res.status(400).json({ error: 'granularity is required' })
  }
  if (!VALID_GRANULARITIES.has(granularity)) {
    return res.status(400).json({ error: `granularity must be one of: ${[...VALID_GRANULARITIES].join(', ')}` })
  }

  const fromStr = typeof from === 'string' ? from : undefined
  const toStr = typeof to === 'string' ? to : undefined
  const fromDate = fromStr ? new Date(fromStr) : new Date(Date.now() - 24 * 60 * 60 * 1000)
  const toDate = toStr ? new Date(toStr) : new Date()

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return res.status(400).json({ error: 'from and to must be valid ISO8601 timestamps' })
  }

  try {
    const bars = await queryHistory(symbol, granularity, fromDate, toDate)
    return res.json({
      sym: symbol,
      granularity,
      candles: bars.map((b) => ({
        t: b.time.toISOString(),
        o: b.open,
        h: b.high,
        l: b.low,
        c: b.close,
        v: b.volume,
      })),
    })
  } catch (err) {
    logger.error({ err, symbol, granularity }, 'GET /api/history failed')
    return res.status(502).json({ error: 'upstream error' })
  }
})

export default router
