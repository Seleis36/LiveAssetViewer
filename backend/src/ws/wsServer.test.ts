import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import http from 'http'
import { AddressInfo } from 'net'
import { WebSocket } from 'ws'

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { attachWsServer } from './wsServer'
import { dispatcher } from './dispatcher'

let server: http.Server
let url: string

beforeAll(async () => {
  server = http.createServer()
  attachWsServer(server)
  await new Promise<void>((resolve) => server.listen(0, resolve))
  url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`
})

afterAll(() => {
  server.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  ;(dispatcher as unknown as { subs: Map<string, Set<unknown>> }).subs.clear()
})

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    ws.on('open', () => resolve(ws))
    ws.on('error', reject)
  })
}

function nextMessage(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    ws.once('message', (d) => resolve(JSON.parse(d.toString())))
  })
}

describe('wsServer', () => {
  it('responds to ping with pong echoing ts', async () => {
    const ws = await connect()
    ws.send(JSON.stringify({ type: 'ping', ts: 1234 }))
    const msg = await nextMessage(ws)
    expect(msg).toEqual({ type: 'pong', ts: 1234 })
    ws.close()
  })

  it('returns BAD_JSON error for invalid JSON', async () => {
    const ws = await connect()
    ws.send('not json')
    const msg = await nextMessage(ws)
    expect(msg.type).toBe('error')
    expect(msg.code).toBe('BAD_JSON')
    ws.close()
  })

  it('registers a subscription with the dispatcher', async () => {
    const spy = vi.spyOn(dispatcher, 'subscribe')
    const ws = await connect()
    ws.send(JSON.stringify({ type: 'subscribe', symbol: 'AAPL', granularity: '5m' }))
    await vi.waitFor(() => expect(spy).toHaveBeenCalled())
    expect(spy.mock.calls[0][0]).toBe('AAPL')
    expect(spy.mock.calls[0][1]).toBe('5m')
    ws.close()
  })

  it('replaces the previous subscription on re-subscribe', async () => {
    const unsub = vi.spyOn(dispatcher, 'unsubscribe')
    const ws = await connect()
    ws.send(JSON.stringify({ type: 'subscribe', symbol: 'AAPL', granularity: '1m' }))
    ws.send(JSON.stringify({ type: 'subscribe', symbol: 'GOOGL', granularity: '1m' }))
    await vi.waitFor(() => expect(unsub).toHaveBeenCalledWith('AAPL', expect.anything()))
    expect(dispatcher.granularitiesFor('GOOGL')).toEqual(['1m'])
    expect(dispatcher.granularitiesFor('AAPL')).toEqual([])
    ws.close()
  })

  it('rejects subscribe with missing symbol', async () => {
    const ws = await connect()
    ws.send(JSON.stringify({ type: 'subscribe', granularity: '1m' }))
    const msg = await nextMessage(ws)
    expect(msg.type).toBe('error')
    expect(msg.code).toBe('BAD_SUBSCRIBE')
    ws.close()
  })

  it('rejects subscribe with invalid granularity', async () => {
    const ws = await connect()
    ws.send(JSON.stringify({ type: 'subscribe', symbol: 'AAPL', granularity: '2m' }))
    const msg = await nextMessage(ws)
    expect(msg.type).toBe('error')
    expect(msg.code).toBe('BAD_SUBSCRIBE')
    ws.close()
  })

  it('unsubscribe removes the subscription', async () => {
    const ws = await connect()
    ws.send(JSON.stringify({ type: 'subscribe', symbol: 'AAPL', granularity: '1m' }))
    await vi.waitFor(() => expect(dispatcher.activeCount()).toBe(1))
    ws.send(JSON.stringify({ type: 'unsubscribe' }))
    await vi.waitFor(() => expect(dispatcher.activeCount()).toBe(0))
    ws.close()
  })

  it('cleans up subscription on socket close', async () => {
    const ws = await connect()
    ws.send(JSON.stringify({ type: 'subscribe', symbol: 'AAPL', granularity: '1m' }))
    await vi.waitFor(() => expect(dispatcher.activeCount()).toBe(1))
    ws.close()
    await vi.waitFor(() => expect(dispatcher.activeCount()).toBe(0))
  })
})
