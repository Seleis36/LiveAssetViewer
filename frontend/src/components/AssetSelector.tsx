import { useAssetStore } from '../store/assetStore'

const GRANULARITIES = ['1m', '5m', '15m', '1h', '1d']

export default function AssetSelector() {
  const { symbols, selectedSym, granularity, selectSym, setGranularity } = useAssetStore()

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.75rem 1rem', background: '#1a1a2e' }}>
      <label style={{ color: '#aaa', fontSize: 13 }}>Symbol</label>
      <select
        value={selectedSym ?? ''}
        onChange={(e) => selectSym(e.target.value)}
        style={{ padding: '4px 8px', borderRadius: 4, background: '#16213e', color: '#fff', border: '1px solid #333' }}
      >
        {symbols.map((s) => (
          <option key={s.sym} value={s.sym}>
            {s.sym} — {s.description}
          </option>
        ))}
      </select>

      <label style={{ color: '#aaa', fontSize: 13 }}>Granularity</label>
      <select
        value={granularity}
        onChange={(e) => setGranularity(e.target.value)}
        style={{ padding: '4px 8px', borderRadius: 4, background: '#16213e', color: '#fff', border: '1px solid #333' }}
      >
        {GRANULARITIES.map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
    </div>
  )
}
