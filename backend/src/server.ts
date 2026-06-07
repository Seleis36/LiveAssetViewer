import express from 'express'
import { Redis } from 'ioredis'
import { pinoHttp } from 'pino-http'
import { config } from './config'
import { logger } from './logger'
import { initKdb } from './kdb/client'
import healthRouter from './routes/health'
import historyRouter from './routes/history'
import { createSymbolsRouter } from './routes/symbols'

const app = express()

app.use(express.json())
app.use(pinoHttp({ logger }))

const redis = new Redis(config.redis.url, { lazyConnect: true })

redis.on('error', (err) => logger.warn({ err }, 'Redis error'))

app.use(healthRouter)
app.use(historyRouter)
app.use(createSymbolsRouter(redis))

async function start(): Promise<void> {
  await redis.connect()
  initKdb()

  app.listen(config.port, () => {
    logger.info({ port: config.port }, 'Backend listening')
  })
}

start().catch((err) => {
  logger.error({ err }, 'Startup failed')
  process.exit(1)
})

export { app }
