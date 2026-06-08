import { useEffect, useState } from 'react'
import { useMarketStore } from './stores/useMarketStore'
import { ConnectionIndicator } from './components/ConnectionIndicator'
import AssetSelector from './components/AssetSelector'
import CandleChart from './components/CandleChart'
import { wsClient } from './services/wsClient'
import { fetchSymbols, fetchHistory, type Symbol } from './api/client'

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000/ws'

export default function App() {
  const [symbols, setSymbols] = useState<Symbol[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { selectedAsset, granularity, candles, pushCandles, setSelectedAsset } = useMarketStore()

  useEffect(() => {
    wsClient.connect(WS_URL)
    fetchSymbols()
      .then((syms) => {
        setSymbols(syms)
        if (syms.length > 0) setSelectedAsset(syms[0].sym)
      })
      .catch(() => setError('Failed to load symbols'))
      .finally(() => setLoading(false))

    return () => wsClient.destroy()
  }, [setSelectedAsset])

  useEffect(() => {
    if (!selectedAsset) return

    wsClient.subscribe(selectedAsset, granularity)

    const to = new Date()
    const from = new Date(to.getTime() - 24 * 60 * 60 * 1000)
    fetchHistory(selectedAsset, granularity, from.toISOString(), to.toISOString())
      .then((candles) => pushCandles(candles))
      .catch((err) => console.error('history fetch failed', err))
  }, [selectedAsset, granularity, pushCandles])

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#eee', fontFamily: 'sans-serif' }}>
      <header style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: 1 }}>LiveAssetViewer</span>
        {selectedAsset && (
          <span style={{ color: '#888', fontSize: 13 }}>{selectedAsset} · {granularity}</span>
        )}
        <span style={{ marginLeft: 'auto' }}>
          <ConnectionIndicator />
        </span>
      </header>

      {!loading && !error && <AssetSelector symbols={symbols} />}

      <main style={{ padding: '0.5rem 0' }}>
        {loading && <div style={{ color: '#888', textAlign: 'center', padding: '3rem' }}>Loading…</div>}
        {error && <div style={{ color: '#ef5350', textAlign: 'center', padding: '1rem' }}>{error}</div>}
        {!loading && !error && <CandleChart candles={candles} />}
      </main>
    </div>
  )
}
