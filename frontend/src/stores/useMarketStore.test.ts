import { describe, it, expect, beforeEach } from 'vitest'
import { useMarketStore } from './useMarketStore'

const candle = (t: string, c: number) => ({ t, o: 100, h: 105, l: 95, c, v: 1000 })

beforeEach(() => {
  useMarketStore.setState({ selectedAsset: 'AAPL', candles: [] })
})

describe('useMarketStore', () => {
  it('initialises with default asset', () => {
    expect(useMarketStore.getState().selectedAsset).toBe('AAPL')
  })

  it('setSelectedAsset clears candles', () => {
    useMarketStore.getState().pushCandles([candle('t1', 100)])
    useMarketStore.getState().setSelectedAsset('MSFT')
    expect(useMarketStore.getState().candles).toHaveLength(0)
    expect(useMarketStore.getState().selectedAsset).toBe('MSFT')
  })

  it('pushCandles replaces the candle list', () => {
    useMarketStore.getState().pushCandles([candle('t1', 100), candle('t2', 101)])
    expect(useMarketStore.getState().candles).toHaveLength(2)
  })

  it('updateLastCandle replaces last candle when timestamp matches', () => {
    useMarketStore.getState().pushCandles([candle('t1', 100)])
    useMarketStore.getState().updateLastCandle(candle('t1', 102))
    const { candles } = useMarketStore.getState()
    expect(candles).toHaveLength(1)
    expect(candles[0].c).toBe(102)
  })

  it('updateLastCandle appends when timestamp differs', () => {
    useMarketStore.getState().pushCandles([candle('t1', 100)])
    useMarketStore.getState().updateLastCandle(candle('t2', 105))
    expect(useMarketStore.getState().candles).toHaveLength(2)
  })
})
