import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import healthRouter from './health'

vi.mock('../kdb/client', () => ({
  isKdbConnected: vi.fn(() => false),
  initKdb: vi.fn(),
  getKdbClient: vi.fn(),
  onKdbConnect: vi.fn(),
}))

import { isKdbConnected } from '../kdb/client'

const app = express()
app.use(healthRouter)

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})

describe('GET /ready', () => {
  beforeEach(() => vi.mocked(isKdbConnected).mockReturnValue(false))

  it('returns 503 when kdb+ not connected', async () => {
    const res = await request(app).get('/ready')
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ status: 'not ready' })
  })

  it('returns 200 when kdb+ is connected', async () => {
    vi.mocked(isKdbConnected).mockReturnValue(true)
    const res = await request(app).get('/ready')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
