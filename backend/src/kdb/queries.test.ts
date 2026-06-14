import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./client', () => ({
  getKdbClient: vi.fn(),
}))

import { getKdbClient } from './client'
import { querySymbols, queryHistory, KdbBar } from './queries'

type KCallback = (err: Error | undefined, result: unknown) => void

function mockClient(result: unknown, err?: Error) {
  const k = vi.fn((...args: unknown[]) => {
    const cb = args[args.length - 1] as KCallback
    cb(err, result)
  })
  vi.mocked(getKdbClient).mockReturnValue({ k } as never)
  return k
}

describe('querySymbols', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns symbol rows from kdb', async () => {
    const rows = [{ sym: 'AAPL', description: 'Apple Inc.' }]
    mockClient(rows)
    await expect(querySymbols()).resolves.toEqual(rows)
  })

  it('rejects when kdb returns an error', async () => {
    mockClient(undefined, new Error('nope'))
    await expect(querySymbols()).rejects.toThrow('nope')
  })
})

describe('queryHistory', () => {
  beforeEach(() => vi.clearAllMocks())

  const bar = (time: Date): KdbBar => ({
    time, sym: 'AAPL', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100,
  })

  it('rejects unsupported granularity without calling kdb', async () => {
    const k = mockClient([])
    await expect(queryHistory('AAPL', '2m', new Date(), new Date())).rejects.toThrow(/granularity/i)
    expect(k).not.toHaveBeenCalled()
  })

  it('passes granularity in nanoseconds to buildBars', async () => {
    const k = mockClient([])
    await queryHistory('AAPL', '5m', new Date(0), new Date(1000))
    expect(k.mock.calls[0][0]).toBe('buildBars')
    expect(k.mock.calls[0][2]).toBe(300_000_000_000)
  })

  it('rounds 1ms-early timestamps up to the exact bar boundary', async () => {
    mockClient([bar(new Date('2026-06-12T15:40:59.999Z'))])
    const bars = await queryHistory('AAPL', '1m', new Date(0), new Date())
    expect(bars[0].time.toISOString()).toBe('2026-06-12T15:41:00.000Z')
  })

  it('leaves exact timestamps unchanged', async () => {
    mockClient([bar(new Date('2026-06-12T15:40:00.000Z'))])
    const bars = await queryHistory('AAPL', '1m', new Date(0), new Date())
    expect(bars[0].time.toISOString()).toBe('2026-06-12T15:40:00.000Z')
  })
})
