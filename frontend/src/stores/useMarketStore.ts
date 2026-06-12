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
      const idx = state.candles.findIndex((c) => c.t === candle.t)
      if (idx >= 0) {
        const next = [...state.candles]
        next[idx] = candle
        return { candles: next }
      }
      // ISO timestamps compare lexicographically; ignore stale out-of-order bars
      if (candle.t > state.candles[state.candles.length - 1].t) {
        return { candles: [...state.candles, candle] }
      }
      return {}
    }),

  clearCandles: () => set({ candles: [] }),
}))
