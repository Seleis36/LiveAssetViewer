import { create } from 'zustand'

export interface Candle {
  t: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

interface MarketStore {
  selectedAsset: string
  granularity: string
  candles: Candle[]
  setSelectedAsset: (sym: string) => void
  setGranularity: (gran: string) => void
  pushCandles: (candles: Candle[]) => void
  updateLastCandle: (candle: Candle) => void
  clearCandles: () => void
}

export const useMarketStore = create<MarketStore>((set) => ({
  selectedAsset: 'AAPL',
  granularity: '1m',
  candles: [],

  setSelectedAsset: (sym) => set({ selectedAsset: sym, candles: [] }),

  setGranularity: (gran) => set({ granularity: gran, candles: [] }),

  pushCandles: (candles) => set({ candles }),

  updateLastCandle: (candle) =>
    set((state) => {
      if (state.candles.length === 0) return { candles: [candle] }
      const last = state.candles[state.candles.length - 1]
      if (last.t === candle.t) {
        return { candles: [...state.candles.slice(0, -1), candle] }
      }
      return { candles: [...state.candles, candle] }
    }),

  clearCandles: () => set({ candles: [] }),
}))
