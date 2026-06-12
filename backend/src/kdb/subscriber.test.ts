import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Connection } from 'node-q'

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
vi.mock('./queries', () => ({
  queryHistory: vi.fn(),
}))

import { queryHistory } from './queries'
import { dispatcher } from '../ws/dispatcher'
import { startSubscriber } from './subscriber'

type UpdHandler = (table: string, data: unknown) => Promise<void>

function fakeConn() {
  let updHandler: UpdHandler | undefined
  const conn = {
    ks: vi.fn((_q: string, cb: (err?: Error) => void) => cb(undefined)),
    on: vi.fn((event: string, handler: UpdHandler) => {
      if (event === 'upd') updHandler = handler
    }),
  } as unknown as Connection
  return { conn, fireUpd: (table: string, data: unknown) => updHandler!(table, data) }
}

const bar = {
  time: new Date('2026-06-12T15:41:00.000Z'),
  sym: 'AAPL', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100,
}

describe('startSubscriber', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(dispatcher as unknown as { subs: Map<string, Set<unknown>> }).subs.clear()
  })

  it('subscribes to the tickerplant trade table', () => {
    const { conn } = fakeConn()
    startSubscriber(conn)
    expect(conn.ks).toHaveBeenCalledWith('.u.sub[`trade;`]', expect.any(Function))
  })

  it('fans out one candle per active granularity on upd', async () => {
    vi.spyOn(dispatcher, 'granularitiesFor').mockReturnValue(['1m', '15m'])
    const fanOut = vi.spyOn(dispatcher, 'fanOut').mockImplementation(() => {})
    vi.mocked(queryHistory).mockResolvedValue([bar])

    const { conn, fireUpd } = fakeConn()
    startSubscriber(conn)
    await fireUpd('trade', [{ sym: 'AAPL' }])

    expect(queryHistory).toHaveBeenCalledTimes(2)
    expect(fanOut).toHaveBeenCalledWith('AAPL', '1m', expect.objectContaining({ o: 1, c: 1.5, v: 100 }))
    expect(fanOut).toHaveBeenCalledWith('AAPL', '15m', expect.anything())
  })

  it('does nothing for non-trade tables', async () => {
    const fanOut = vi.spyOn(dispatcher, 'fanOut').mockImplementation(() => {})
    const { conn, fireUpd } = fakeConn()
    startSubscriber(conn)
    await fireUpd('quote', [{ sym: 'AAPL' }])
    expect(fanOut).not.toHaveBeenCalled()
  })

  it('skips symbols with no subscribers', async () => {
    vi.spyOn(dispatcher, 'granularitiesFor').mockReturnValue([])
    const { conn, fireUpd } = fakeConn()
    startSubscriber(conn)
    await fireUpd('trade', [{ sym: 'AAPL' }])
    expect(queryHistory).not.toHaveBeenCalled()
  })

  it('survives queryHistory failures', async () => {
    vi.spyOn(dispatcher, 'granularitiesFor').mockReturnValue(['1m'])
    const fanOut = vi.spyOn(dispatcher, 'fanOut').mockImplementation(() => {})
    vi.mocked(queryHistory).mockRejectedValue(new Error('kdb down'))

    const { conn, fireUpd } = fakeConn()
    startSubscriber(conn)
    await expect(fireUpd('trade', [{ sym: 'AAPL' }])).resolves.toBeUndefined()
    expect(fanOut).not.toHaveBeenCalled()
  })
})
