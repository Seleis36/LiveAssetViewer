import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSymbols, fetchHistory } from './client'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  }
}

beforeEach(() => vi.clearAllMocks())

describe('fetchSymbols', () => {
  it('returns symbols array on success', async () => {
    const symbols = [{ sym: 'AAPL', description: 'Apple Inc.' }]
    mockFetch.mockResolvedValue(mockResponse({ symbols }))
    const result = await fetchSymbols()
    expect(result).toEqual(symbols)
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue(mockResponse({}, false, 503))
    await expect(fetchSymbols()).rejects.toThrow('fetchSymbols: 503')
  })
})

describe('fetchHistory', () => {
  it('returns candles array on success', async () => {
    const candles = [{ t: '2025-01-10T09:30:00Z', o: 185, h: 186, l: 184, c: 185.5, v: 100 }]
    mockFetch.mockResolvedValue(mockResponse({ candles }))
    const result = await fetchHistory('AAPL', '1m')
    expect(result).toEqual(candles)
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/history/AAPL'))
  })

  it('includes from/to params when provided', async () => {
    mockFetch.mockResolvedValue(mockResponse({ candles: [] }))
    await fetchHistory('AAPL', '5m', '2025-01-10T09:00:00Z', '2025-01-10T10:00:00Z')
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('granularity=5m')
    expect(url).toContain('from=')
    expect(url).toContain('to=')
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue(mockResponse({}, false, 404))
    await expect(fetchHistory('AAPL', '1m')).rejects.toThrow('fetchHistory: 404')
  })
})
