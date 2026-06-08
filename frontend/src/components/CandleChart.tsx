import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts'
import dayjs from 'dayjs'
import { Candle } from '../api/client'

interface ChartRow {
  time: number
  label: string
  // candle body: [low, high] range with open/close stored as extras
  bodyLow: number
  bodyHigh: number
  wickLow: number
  wickHigh: number
  open: number
  close: number
  volume: number
  bullish: boolean
}

// eslint-disable-next-line react-refresh/only-export-components
export function toRows(candles: Candle[]): ChartRow[] {
  return candles.map((c) => {
    const bullish = c.c >= c.o
    return {
      time: new Date(c.t).getTime(),
      label: dayjs(c.t).format('HH:mm'),
      bodyLow: Math.min(c.o, c.c),
      bodyHigh: Math.max(c.o, c.c),
      wickLow: c.l,
      wickHigh: c.h,
      open: c.o,
      close: c.c,
      volume: c.v,
      bullish,
    }
  })
}

interface CandleShapeProps {
  x: number
  width: number
  wickLow: number
  wickHigh: number
  bodyLow: number
  bodyHigh: number
  bullish: boolean
  yAxis?: { scale: (v: number) => number }
  [key: string]: unknown
}

// Custom shape that draws full candle: wick line + body rect
// eslint-disable-next-line react-refresh/only-export-components
export const CandleShape = (props: CandleShapeProps) => {
  const { x, width, wickLow, wickHigh, bodyLow, bodyHigh, bullish, yAxis } = props
  if (!yAxis) return null

  const color = bullish ? '#26a69a' : '#ef5350'
  const cx = x + width / 2

  // Map data values to pixel y (yAxis.scale is the d3 scale)
  const toY = (v: number) => yAxis.scale(v)

  const wickY1 = toY(wickHigh)
  const wickY2 = toY(wickLow)
  const bodyY1 = toY(bodyHigh)
  const bodyY2 = toY(bodyLow)
  const bodyH = Math.max(1, bodyY2 - bodyY1)
  const bodyW = Math.max(2, width * 0.6)

  return (
    <g>
      {/* wick */}
      <line x1={cx} y1={wickY1} x2={cx} y2={wickY2} stroke={color} strokeWidth={1} />
      {/* body */}
      <rect
        x={cx - bodyW / 2}
        y={bodyY1}
        width={bodyW}
        height={bodyH}
        fill={color}
        stroke={color}
        strokeWidth={0.5}
      />
    </g>
  )
}

interface Props {
  candles: Candle[]
}

export default function CandleChart({ candles }: Props) {
  if (candles.length === 0) {
    return <div style={{ color: '#666', textAlign: 'center', padding: '3rem' }}>No data</div>
  }

  const rows = toRows(candles)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 1rem 1rem' }}>
      {/* Price chart */}
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 11 }} minTickGap={40} />
          <YAxis
            dataKey="bodyLow"
            domain={['auto', 'auto']}
            tick={{ fill: '#888', fontSize: 11 }}
            width={70}
            tickFormatter={(v) => v.toFixed(2)}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as ChartRow
              return (
                <div style={{ background: '#1a1a2e', border: '1px solid #333', padding: '8px 12px', fontSize: 12, color: '#eee' }}>
                  <div>{dayjs(d.time).format('YYYY-MM-DD HH:mm')}</div>
                  <div>O: {d.open.toFixed(4)}  H: {d.wickHigh.toFixed(4)}</div>
                  <div>L: {d.wickLow.toFixed(4)}  C: {d.close.toFixed(4)}</div>
                  <div style={{ color: '#aaa' }}>Vol: {d.volume.toLocaleString()}</div>
                </div>
              )
            }}
          />
          <Bar
            dataKey="bodyHigh"
            shape={(props: CandleShapeProps) => <CandleShape {...props} />}
            isAnimationActive={false}
          >
            {rows.map((r, i) => (
              <Cell key={i} fill={r.bullish ? '#26a69a' : '#ef5350'} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>

      {/* Volume sub-chart */}
      <ResponsiveContainer width="100%" height={80}>
        <ComposedChart data={rows} margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
          <XAxis dataKey="label" hide />
          <YAxis tick={{ fill: '#888', fontSize: 10 }} width={70} tickFormatter={(v) => (v / 1e6).toFixed(1) + 'M'} />
          <Bar dataKey="volume" isAnimationActive={false} maxBarSize={12}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.bullish ? '#1a5c5833' : '#5c1a1a33'} stroke={r.bullish ? '#26a69a' : '#ef5350'} strokeWidth={1} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
