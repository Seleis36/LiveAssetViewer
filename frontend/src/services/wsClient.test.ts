import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useConnectionStore } from '../stores/useConnectionStore'
import { useMarketStore } from '../stores/useMarketStore'

class MockWebSocket {
  static OPEN = 1
  static CLOSED = 3
  readyState = MockWebSocket.OPEN
  url!: string
  onopen: (() => void) | null = null
  onmessage: ((evt: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  send = vi.fn()
  close = vi.fn()
}

let lastWs: MockWebSocket

vi.stubGlobal('WebSocket', class extends MockWebSocket {
  constructor(url: string) {
    super()
    this.url = url
    lastWs = this as unknown as MockWebSocket
  }
})

// Import after global stub
const { wsClient } = await import('./wsClient')

function resetClient() {
  const c = wsClient as unknown as {
    destroyed: boolean
    ws: null
    symbol: null
    granularity: string
    delay: number
    pingTimer: null
    reconnectTimer: null
  }
  c.destroyed = false
  c.ws = null
  c.symbol = null
  c.granularity = '1m'
  c.delay = 500
  c.pingTimer = null
  c.reconnectTimer = null
}

beforeEach(() => {
  useConnectionStore.setState({ status: 'closed' })
  useMarketStore.setState({ candles: [] })
  vi.clearAllMocks()
  resetClient()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('wsClient — connect', () => {
  it('sets status to connecting on connect', () => {
    wsClient.connect('ws://localhost:3000/ws')
    expect(useConnectionStore.getState().status).toBe('connecting')
  })

  it('sets status to open when connection opens', () => {
    wsClient.connect('ws://localhost:3000/ws')
    lastWs.onopen!()
    expect(useConnectionStore.getState().status).toBe('open')
  })

  it('does nothing when destroyed', () => {
    ;(wsClient as unknown as { destroyed: boolean }).destroyed = true
    wsClient.connect('ws://localhost:3000/ws')
    expect(useConnectionStore.getState().status).toBe('closed')
  })
})

describe('wsClient — onerror / onclose', () => {
  it('sets status to error on ws error', () => {
    wsClient.connect('ws://localhost:3000/ws')
    lastWs.onerror!()
    expect(useConnectionStore.getState().status).toBe('error')
  })

  it('sets status to closed on ws close and schedules reconnect', () => {
    vi.useFakeTimers()
    wsClient.connect('ws://localhost:3000/ws')
    lastWs.onopen!()
    lastWs.onclose!()
    expect(useConnectionStore.getState().status).toBe('closed')
    // After reconnect delay a new WebSocket should be created
    vi.advanceTimersByTime(600)
    expect(useConnectionStore.getState().status).toBe('connecting')
  })

  it('does not reconnect when destroyed', () => {
    vi.useFakeTimers()
    wsClient.connect('ws://localhost:3000/ws')
    lastWs.onopen!()
    ;(wsClient as unknown as { destroyed: boolean }).destroyed = true
    lastWs.onclose!()
    vi.advanceTimersByTime(600)
    // onclose returns early; no setStatus('closed') and no new connect('connecting')
    expect(useConnectionStore.getState().status).not.toBe('connecting')
  })
})

describe('wsClient — messages', () => {
  it('handles snapshot message', () => {
    wsClient.connect('ws://localhost:3000/ws')
    lastWs.onopen!()
    const candles = [{ t: '2025-01-01T00:00:00Z', o: 100, h: 110, l: 95, c: 105, v: 1000 }]
    lastWs.onmessage!({ data: JSON.stringify({ type: 'snapshot', candles }) })
    expect(useMarketStore.getState().candles).toHaveLength(1)
  })

  it('handles candle_update message', () => {
    wsClient.connect('ws://localhost:3000/ws')
    lastWs.onopen!()
    const candle = { t: '2025-01-01T00:00:00Z', o: 100, h: 110, l: 95, c: 105, v: 1000 }
    lastWs.onmessage!({ data: JSON.stringify({ type: 'candle_update', candle }) })
    expect(useMarketStore.getState().candles).toHaveLength(1)
  })

  it('ignores invalid JSON messages', () => {
    wsClient.connect('ws://localhost:3000/ws')
    lastWs.onopen!()
    expect(() => lastWs.onmessage!({ data: 'not json' })).not.toThrow()
  })
})

describe('wsClient — subscribe', () => {
  it('sends subscribe when symbol is set and connection is open', () => {
    wsClient.connect('ws://localhost:3000/ws')
    lastWs.onopen!()
    wsClient.subscribe('AAPL', '1m')
    expect(lastWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'subscribe', symbol: 'AAPL', granularity: '1m' }),
    )
  })

  it('stores symbol/granularity but does not send when not open', () => {
    lastWs = { ...new MockWebSocket(), readyState: MockWebSocket.CLOSED } as unknown as MockWebSocket
    wsClient.connect('ws://localhost:3000/ws')
    lastWs.readyState = MockWebSocket.CLOSED
    wsClient.subscribe('GOOGL', '5m')
    // send called once for connect(→connecting), not for subscribe
    expect(lastWs.send).not.toHaveBeenCalled()
  })
})

describe('wsClient — destroy', () => {
  it('closes the WebSocket and stops reconnecting', () => {
    vi.useFakeTimers()
    wsClient.connect('ws://localhost:3000/ws')
    lastWs.onopen!()
    wsClient.destroy()
    expect(lastWs.close).toHaveBeenCalled()
    expect((wsClient as unknown as { destroyed: boolean }).destroyed).toBe(true)
  })

  it('clears reconnect timer on destroy', () => {
    vi.useFakeTimers()
    wsClient.connect('ws://localhost:3000/ws')
    lastWs.onopen!()
    lastWs.onclose!()
    // timer is pending — destroy cancels it
    wsClient.destroy()
    vi.advanceTimersByTime(2000)
    // no new connection attempt (still closed)
    expect(useConnectionStore.getState().status).toBe('closed')
  })
})

describe('wsClient — ping', () => {
  it('sends ping message on interval', () => {
    vi.useFakeTimers()
    wsClient.connect('ws://localhost:3000/ws')
    lastWs.onopen!()
    vi.advanceTimersByTime(30_001)
    const pings = lastWs.send.mock.calls.filter(([m]: string[]) => m.includes('"type":"ping"'))
    expect(pings.length).toBeGreaterThanOrEqual(1)
  })
})
