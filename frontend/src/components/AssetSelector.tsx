import { useMarketStore } from '../stores/useMarketStore'

const GRANULARITIES = ['1m', '5m', '15m', '1h', '1d']

interface Symbol {
  sym: string
  description: string
}

interface Props {
  symbols: Symbol[]
}

export default function AssetSelector({ symbols }: Props) {
  const { selectedAsset, granularity, setSelectedAsset, setGranularity } = useMarketStore()

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.75rem 1rem', background: '#1a1a2e' }}>
      <label style={{ color: '#aaa', fontSize: 13 }}>Symbol</label>
      <select
        value={selectedAsset}
        onChange={(e) => setSelectedAsset(e.target.value)}
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
