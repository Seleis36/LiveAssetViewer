import { create } from 'zustand'
import { Symbol, Candle, fetchSymbols, fetchHistory } from '../api/client'

interface AssetState {
  symbols: Symbol[]
  selectedSym: string | null
  granularity: string
  candles: Candle[]
  loading: boolean
  error: string | null

  loadSymbols: () => Promise<void>
  selectSym: (sym: string) => void
  setGranularity: (gran: string) => void
  loadHistory: () => Promise<void>
}

export const useAssetStore = create<AssetState>((set, get) => ({
  symbols: [],
  selectedSym: null,
  granularity: '5m',
  candles: [],
  loading: false,
  error: null,

  loadSymbols: async () => {
    set({ loading: true, error: null })
    try {
      const symbols = await fetchSymbols()
      const first = symbols[0]?.sym ?? null
      set({ symbols, selectedSym: first, loading: false })
      if (first) await get().loadHistory()
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },

  selectSym: (sym) => {
    set({ selectedSym: sym })
    get().loadHistory()
  },

  setGranularity: (gran) => {
    set({ granularity: gran })
    get().loadHistory()
  },

  loadHistory: async () => {
    const { selectedSym, granularity } = get()
    if (!selectedSym) return
    set({ loading: true, error: null })
    try {
      const candles = await fetchHistory(selectedSym, granularity)
      set({ candles, loading: false })
    } catch (e) {
      set({ error: String(e), loading: false })
    }
  },
}))
