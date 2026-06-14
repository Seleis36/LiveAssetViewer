import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import historyRouter from './history'

vi.mock('../kdb/queries', () => ({
  querySymbols: vi.fn(),
  queryHistory: vi.fn(),
}))

import { queryHistory } from '../kdb/queries'

const mockBars = [
  { time: new Date('2025-01-10T09:30:00Z'), sym: 'AAPL', open: 185.12, high: 185.90, low: 184.80, close: 185.55, volume: 12043210 },
]

const app = express()
app.use(historyRouter)

describe('GET /api/history/:symbol', () => {
  beforeEach(() => {
    vi.mocked(queryHistory).mockResolvedValue(mockBars)
  })

  it('returns candle data with valid params', async () => {
    const res = await request(app).get('/api/history/AAPL?granularity=1m')
    expect(res.status).toBe(200)
    expect(res.body.sym).toBe('AAPL')
    expect(res.body.granularity).toBe('1m')
    expect(res.body.candles).toHaveLength(1)
    const c = res.body.candles[0]
    expect(c).toMatchObject({ o: 185.12, h: 185.90, l: 184.80, c: 185.55, v: 12043210 })
  })

  it('returns 400 when granularity is missing', async () => {
    const res = await request(app).get('/api/history/AAPL')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/granularity/)
  })

  it('returns 400 for invalid granularity', async () => {
    const res = await request(app).get('/api/history/AAPL?granularity=2m')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/granularity/)
  })

  it('returns 400 for invalid from date', async () => {
    const res = await request(app).get('/api/history/AAPL?granularity=1m&from=not-a-date')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/ISO8601/)
  })

  it('returns 502 when kdb+ query fails', async () => {
    vi.mocked(queryHistory).mockRejectedValue(new Error('kdb+ down'))
    const res = await request(app).get('/api/history/AAPL?granularity=5m')
    expect(res.status).toBe(502)
    expect(res.body.error).toBe('upstream error')
  })
})
