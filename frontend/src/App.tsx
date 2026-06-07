import { useEffect } from 'react'
import { useAssetStore } from './store/assetStore'
import AssetSelector from './components/AssetSelector'
import CandleChart from './components/CandleChart'

export default function App() {
  const { loadSymbols, candles, loading, error, selectedSym, granularity } = useAssetStore()

  useEffect(() => { loadSymbols() }, [loadSymbols])

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', color: '#eee', fontFamily: 'sans-serif' }}>
      <header style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: 1 }}>LiveAssetViewer</span>
        {selectedSym && (
          <span style={{ color: '#888', fontSize: 13 }}>{selectedSym} · {granularity}</span>
        )}
      </header>

      <AssetSelector />

      <main style={{ padding: '0.5rem 0' }}>
        {loading && <div style={{ color: '#888', textAlign: 'center', padding: '3rem' }}>Loading…</div>}
        {error && <div style={{ color: '#ef5350', textAlign: 'center', padding: '1rem' }}>{error}</div>}
        {!loading && !error && <CandleChart candles={candles} />}
      </main>
    </div>
  )
}
