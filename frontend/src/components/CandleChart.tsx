import { useMemo } from 'react'
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
import type { BarProps } from 'recharts'
import dayjs from 'dayjs'
import { Candle } from '../api/client'

interface ChartRow {
  time: number
  label: string
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
  y: number
  height: number
  wickLow: number
  wickHigh: number
  bodyLow: number
  bodyHigh: number
  bullish: boolean
  [key: string]: unknown
}

// In Recharts v3, shape functions receive x/y/width/height (pixel coords for the bar)
// plus all data attributes. No yAxis.scale — derive the scale from y, height, bodyHigh, priceMin.
//
// With domain=[priceMin, priceMax], Recharts sets baseValue = priceMin, so:
//   y         = pixel(bodyHigh)
//   y+height  = pixel(priceMin)
// → toY(v) = y + height * (v - bodyHigh) / (priceMin - bodyHigh)
// eslint-disable-next-line react-refresh/only-export-components
export function makeCandleShape(priceMin: number) {
  return function CandleShape(props: CandleShapeProps) {
    const { x, y, width, height, wickLow, wickHigh, bodyLow, bodyHigh, bullish } = props

    if (!height || height <= 0 || priceMin >= bodyHigh) return null

    const toY = (v: number) => y + height * (v - bodyHigh) / (priceMin - bodyHigh)

    const color = bullish ? '#26a69a' : '#ef5350'
    const cx = x + width / 2
    const bodyW = Math.max(2, width * 0.6)
    const bodyTop = toY(bodyHigh)
    const bodyBot = toY(bodyLow)

    return (
      <g>
        <line x1={cx} y1={toY(wickHigh)} x2={cx} y2={toY(wickLow)} stroke={color} strokeWidth={1} />
        <rect
          x={cx - bodyW / 2}
          y={bodyTop}
          width={bodyW}
          height={Math.max(1, bodyBot - bodyTop)}
          fill={color}
          stroke={color}
          strokeWidth={0.5}
        />
      </g>
    )
  }
}

interface Props {
  candles: Candle[]
}

export default function CandleChart({ candles }: Props) {
  const rows = toRows(candles)

  const priceMin = rows.length > 0 ? Math.min(...rows.map((r) => r.wickLow)) * 0.9998 : 0
  const priceMax = rows.length > 0 ? Math.max(...rows.map((r) => r.wickHigh)) * 1.0002 : 100

  const candleShape = useMemo(() => makeCandleShape(priceMin), [priceMin])

  if (rows.length === 0) {
    return <div style={{ color: '#666', textAlign: 'center', padding: '3rem' }}>No data</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 1rem 1rem' }}>
      {/* Price chart */}
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 11 }} minTickGap={40} />
          <YAxis
            domain={[priceMin, priceMax]}
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
            shape={candleShape as unknown as BarProps['shape']}
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
          <YAxis
            tick={{ fill: '#888', fontSize: 10 }}
            width={70}
            tickFormatter={(v) =>
              v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'K' : String(v)
            }
          />
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
