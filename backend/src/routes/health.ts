import { Router } from 'express'
import { isKdbConnected } from '../kdb/client'

const router = Router()

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

router.get('/ready', (_req, res) => {
  if (isKdbConnected()) {
    res.json({ status: 'ok' })
  } else {
    res.status(503).json({ status: 'not ready' })
  }
})

export default router
