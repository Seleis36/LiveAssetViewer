import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createSymbolsRouter } from './symbols'

vi.mock('../kdb/queries', () => ({
  querySymbols: vi.fn(),
  queryHistory: vi.fn(),
}))

import { querySymbols } from '../kdb/queries'

beforeEach(() => vi.clearAllMocks())

const mockSymbols = [
  { sym: 'AAPL', description: 'Apple Inc.' },
  { sym: 'GOOGL', description: 'Alphabet Inc.' },
]

function makeApp() {
  const redis = {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
  } as unknown as import('ioredis').Redis

  const app = express()
  app.use(createSymbolsRouter(redis))
  return { app, redis }
}

describe('GET /api/symbols', () => {
  beforeEach(() => {
    vi.mocked(querySymbols).mockResolvedValue(mockSymbols)
  })

  it('returns symbols from kdb+ when cache is empty', async () => {
    const { app } = makeApp()
    const res = await request(app).get('/api/symbols')
    expect(res.status).toBe(200)
    expect(res.body.symbols).toEqual(mockSymbols)
  })

  it('returns cached symbols when cache is populated', async () => {
    const cached = JSON.stringify({ symbols: mockSymbols })
    const redis = {
      get: vi.fn().mockResolvedValue(cached),
      setex: vi.fn(),
    } as unknown as import('ioredis').Redis

    const app = express()
    app.use(createSymbolsRouter(redis))

    const res = await request(app).get('/api/symbols')
    expect(res.status).toBe(200)
    expect(res.body.symbols).toEqual(mockSymbols)
    expect(querySymbols).not.toHaveBeenCalled()
  })

  it('returns 502 when kdb+ query fails', async () => {
    vi.mocked(querySymbols).mockRejectedValue(new Error('kdb+ error'))
    const { app } = makeApp()
    const res = await request(app).get('/api/symbols')
    expect(res.status).toBe(502)
    expect(res.body.error).toBe('upstream error')
  })
})
