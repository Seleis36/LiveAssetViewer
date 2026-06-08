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
    dispatcher.fanOut('AAPL', { t: '2025-01-01T00:00:00Z', o: 100, h: 110, l: 95, c: 105, v: 1000 })
    expect(ws.send).toHaveBeenCalledOnce()
    const msg = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string)
    expect(msg.type).toBe('candle_update')
    expect(msg.sym).toBe('AAPL')
  })

  it('fanOut skips closed sockets', () => {
    const ws = makeWs(WebSocket.CLOSED)
    dispatcher.subscribe('AAPL', '1m', ws)
    dispatcher.fanOut('AAPL', { t: '2025-01-01T00:00:00Z', o: 100, h: 110, l: 95, c: 105, v: 1000 })
    expect(ws.send).not.toHaveBeenCalled()
  })

  it('fanOut for unknown symbol does nothing', () => {
    expect(() => dispatcher.fanOut('UNKNOWN', { t: '', o: 0, h: 0, l: 0, c: 0, v: 0 })).not.toThrow()
  })
})
