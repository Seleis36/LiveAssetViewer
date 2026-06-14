import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const connectMock = vi.fn()
vi.mock('node-q', () => ({
  default: { connect: connectMock },
}))

type ConnectCb = (err: Error | null, conn: FakeConn | null) => void

class FakeConn {
  handlers = new Map<string, (arg?: unknown) => void>()
  k = vi.fn()
  on(event: string, handler: (arg?: unknown) => void) {
    this.handlers.set(event, handler)
  }
  emit(event: string, arg?: unknown) {
    this.handlers.get(event)?.(arg)
  }
}

async function freshClient() {
  vi.resetModules()
  connectMock.mockReset()
  return import('./client')
}

describe('kdb client', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('connects and notifies onKdbConnect callbacks', async () => {
    const client = await freshClient()
    const conn = new FakeConn()
    connectMock.mockImplementation((_opts: unknown, cb: ConnectCb) => cb(null, conn))

    const cb = vi.fn()
    client.onKdbConnect(cb as never)
    client.initKdb()

    expect(cb).toHaveBeenCalledWith(conn)
    expect(client.isKdbConnected()).toBe(true)
    expect(client.getKdbClient()).toBe(conn)
  })

  it('retries with backoff when connect fails', async () => {
    const client = await freshClient()
    connectMock.mockImplementation((_opts: unknown, cb: ConnectCb) => cb(new Error('refused'), null))

    client.initKdb()
    expect(connectMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(500)
    expect(connectMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1000)
    expect(connectMock).toHaveBeenCalledTimes(3)
  })

  it('throws when getKdbClient is called before connect', async () => {
    const client = await freshClient()
    expect(() => client.getKdbClient()).toThrow(/not connected/)
  })

  it('reconnects and re-fires callbacks when the connection closes', async () => {
    const client = await freshClient()
    const conns: FakeConn[] = []
    connectMock.mockImplementation((_opts: unknown, cb: ConnectCb) => {
      const c = new FakeConn()
      conns.push(c)
      cb(null, c)
    })

    const cb = vi.fn()
    client.onKdbConnect(cb as never)
    client.initKdb()
    expect(cb).toHaveBeenCalledTimes(1)

    conns[0].emit('close')
    expect(client.isKdbConnected()).toBe(false)
    await vi.advanceTimersByTimeAsync(500)

    expect(client.isKdbConnected()).toBe(true)
    expect(cb).toHaveBeenCalledTimes(2)
    expect(cb).toHaveBeenLastCalledWith(conns[1])
  })

  it('ignores close events from a stale connection', async () => {
    const client = await freshClient()
    const conns: FakeConn[] = []
    connectMock.mockImplementation((_opts: unknown, cb: ConnectCb) => {
      const c = new FakeConn()
      conns.push(c)
      cb(null, c)
    })

    client.initKdb()
    conns[0].emit('close')
    await vi.advanceTimersByTimeAsync(500)
    expect(client.isKdbConnected()).toBe(true)

    // the dead first connection closing again must not drop the live one
    conns[0].emit('close')
    expect(client.isKdbConnected()).toBe(true)
    expect(client.getKdbClient()).toBe(conns[1])
  })
})
