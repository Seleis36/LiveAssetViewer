import express from 'express'
import pino from 'pino'
import pinoHttp from 'pino-http'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'backend' },
  timestamp: pino.stdTimeFunctions.isoTime,
})

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(express.json())
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers['x-request-id'] ?? crypto.randomUUID(),
    customLogLevel: (_req, res) => (res.statusCode >= 500 ? 'error' : 'info'),
    serializers: {
      req: (req) => ({ method: req.method, url: req.url, requestId: req.id }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/ready', (_req, res) => {
  // TODO: check kdb+ connection — replace with real check once kdb client is wired in
  res.status(503).json({ status: 'not ready' })
})

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Backend listening')
})
