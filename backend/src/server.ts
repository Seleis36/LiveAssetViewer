import express from 'express'

const app = express()
const PORT = process.env.PORT ?? 3000

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/ready', (_req, res) => {
  // TODO (US-07): check kdb+ connection before returning 200
  res.status(503).json({ status: 'not ready' })
})

app.listen(PORT, () => {
  console.log(`Backend listening on :${PORT}`)
})
