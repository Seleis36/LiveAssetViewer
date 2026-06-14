import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WebSocket } from 'ws'

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { dispatcher } from './dispatcher'

function makeWs(readyState: number = WebSocket.OPEN): WebSocket {
  return { readyState, send: vi.fn() } as unknown as WebSocket
}

describe('Dispatcher', () => {
  beforeEach(() => {
    // Reset internal state between tests by unsubscribing everything
    ;(dispatcher as unknown as { subs: Map<string, Set<unknown>> }).subs.clear()
  })

  it('tracks active connection count', () => {
    const ws1 = makeWs()
    const ws2 = makeWs()
    dispatcher.subscribe('AAPL', '1m', ws1)
    dispatcher.subscribe('AAPL', '1m', ws2)
    expect(dispatcher.activeCount()).toBe(2)
  })

  it('unsubscribes correctly', () => {
    const ws = makeWs()
    dispatcher.subscribe('AAPL', '1m', ws)
    dispatcher.unsubscribe('AAPL', ws)
    expect(dispatcher.activeCount()).toBe(0)
  })

  it('fanOut sends message to open subscribers', () => {
    const ws = makeWs(WebSocket.OPEN)
    dispatcher.subscribe('AAPL', '1m', ws)
    dispatcher.fanOut('AAPL', '1m', { t: '2025-01-01T00:00:00Z', o: 100, h: 110, l: 95, c: 105, v: 1000 })
    expect(ws.send).toHaveBeenCalledOnce()
    const msg = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string)
    expect(msg.type).toBe('candle_update')
    expect(msg.sym).toBe('AAPL')
    expect(msg.granularity).toBe('1m')
  })

  it('fanOut skips closed sockets', () => {
    const ws = makeWs(WebSocket.CLOSED)
    dispatcher.subscribe('AAPL', '1m', ws)
    dispatcher.fanOut('AAPL', '1m', { t: '2025-01-01T00:00:00Z', o: 100, h: 110, l: 95, c: 105, v: 1000 })
    expect(ws.send).not.toHaveBeenCalled()
  })

  it('fanOut only reaches subscribers with matching granularity', () => {
    const ws1m = makeWs(WebSocket.OPEN)
    const ws15m = makeWs(WebSocket.OPEN)
    dispatcher.subscribe('AAPL', '1m', ws1m)
    dispatcher.subscribe('AAPL', '15m', ws15m)
    dispatcher.fanOut('AAPL', '15m', { t: '2025-01-01T00:00:00Z', o: 100, h: 110, l: 95, c: 105, v: 1000 })
    expect(ws1m.send).not.toHaveBeenCalled()
    expect(ws15m.send).toHaveBeenCalledOnce()
  })

  it('granularitiesFor returns distinct granularities per symbol', () => {
    dispatcher.subscribe('AAPL', '1m', makeWs())
    dispatcher.subscribe('AAPL', '1m', makeWs())
    dispatcher.subscribe('AAPL', '15m', makeWs())
    expect(dispatcher.granularitiesFor('AAPL').sort()).toEqual(['15m', '1m'])
    expect(dispatcher.granularitiesFor('UNKNOWN')).toEqual([])
  })

  it('fanOut for unknown symbol does nothing', () => {
    expect(() => dispatcher.fanOut('UNKNOWN', '1m', { t: '', o: 0, h: 0, l: 0, c: 0, v: 0 })).not.toThrow()
  })
})
