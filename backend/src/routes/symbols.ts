import { Router, Request, Response } from 'express'
import { Redis } from 'ioredis'
import { querySymbols } from '../kdb/queries'
import { logger } from '../logger'

const CACHE_KEY = 'symbols'
const CACHE_TTL_S = 60

export function createSymbolsRouter(redis: Redis): Router {
  const router = Router()

  router.get('/api/symbols', async (_req: Request, res: Response) => {
    try {
      const cached = await redis.get(CACHE_KEY)
      if (cached) {
        return res.json(JSON.parse(cached))
      }

      const symbols = await querySymbols()
      const body = { symbols }
      await redis.setex(CACHE_KEY, CACHE_TTL_S, JSON.stringify(body))
      return res.json(body)
    } catch (err) {
      logger.error({ err }, 'GET /api/symbols failed')
      return res.status(502).json({ error: 'upstream error' })
    }
  })

  return router
}
