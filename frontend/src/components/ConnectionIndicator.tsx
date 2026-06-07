import { useConnectionStore } from '../stores/useConnectionStore'

const DOT: Record<string, { color: string; label: string }> = {
  connecting: { color: '#f59e0b', label: 'Connecting…' },
  open:       { color: '#22c55e', label: 'Connected' },
  closed:     { color: '#6b7280', label: 'Disconnected' },
  error:      { color: '#ef4444', label: 'Error' },
}

export function ConnectionIndicator() {
  const status = useConnectionStore((s) => s.status)
  const { color, label } = DOT[status] ?? DOT.closed

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
        }}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}
