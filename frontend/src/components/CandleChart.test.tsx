import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import CandleChart, { toRows, CandleShape } from './CandleChart'
import type { Candle } from '../api/client'

const candles: Candle[] = [
  { t: '2025-01-10T09:30:00Z', o: 185.12, h: 185.90, l: 184.80, c: 185.55, v: 12043210 },
  { t: '2025-01-10T09:31:00Z', o: 185.55, h: 186.00, l: 185.20, c: 185.80, v: 8500000 },
  { t: '2025-01-10T09:32:00Z', o: 185.80, h: 185.90, l: 184.50, c: 184.60, v: 9200000 },
]

describe('CandleChart', () => {
  it('renders without crashing when no candles', () => {
    render(<CandleChart candles={[]} />)
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('renders chart container when candles are provided', () => {
    const { container } = render(<CandleChart candles={candles} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('does not show "No data" when candles are provided', () => {
    render(<CandleChart candles={candles} />)
    expect(screen.queryByText('No data')).not.toBeInTheDocument()
  })
})

describe('toRows', () => {
  it('maps candle to chart row correctly for bullish candle', () => {
    const c: Candle = { t: '2025-01-10T09:30:00Z', o: 100, h: 110, l: 90, c: 105, v: 5000 }
    const [row] = toRows([c])
    expect(row.bullish).toBe(true)
    expect(row.open).toBe(100)
    expect(row.close).toBe(105)
    expect(row.bodyLow).toBe(100)
    expect(row.bodyHigh).toBe(105)
    expect(row.wickLow).toBe(90)
    expect(row.wickHigh).toBe(110)
    expect(row.volume).toBe(5000)
  })

  it('maps bearish candle correctly', () => {
    const c: Candle = { t: '2025-01-10T09:30:00Z', o: 105, h: 110, l: 90, c: 100, v: 3000 }
    const [row] = toRows([c])
    expect(row.bullish).toBe(false)
    expect(row.bodyLow).toBe(100)
    expect(row.bodyHigh).toBe(105)
  })

  it('returns empty array for no candles', () => {
    expect(toRows([])).toEqual([])
  })

  it('formats time label', () => {
    const c: Candle = { t: '2025-01-10T09:30:00Z', o: 100, h: 110, l: 90, c: 100, v: 0 }
    const [row] = toRows([c])
    expect(row.label).toMatch(/\d{2}:\d{2}/)
    expect(typeof row.time).toBe('number')
  })
})

describe('CandleShape', () => {
  const mockScale = (v: number) => v * 2

  it('returns null when no yAxis provided', () => {
    const { container } = render(
      <svg>
        <CandleShape x={10} width={20} wickLow={90} wickHigh={110} bodyLow={100} bodyHigh={105} bullish={true} />
      </svg>,
    )
    expect(container.querySelector('g')).toBeNull()
  })

  it('renders wick and body for bullish candle', () => {
    const { container } = render(
      <svg>
        <CandleShape
          x={10}
          width={20}
          wickLow={90}
          wickHigh={110}
          bodyLow={100}
          bodyHigh={105}
          bullish={true}
          yAxis={{ scale: mockScale }}
        />
      </svg>,
    )
    expect(container.querySelector('line')).toBeTruthy()
    expect(container.querySelector('rect')).toBeTruthy()
    expect(container.querySelector('line')?.getAttribute('stroke')).toBe('#26a69a')
  })

  it('renders bearish candle with red color', () => {
    const { container } = render(
      <svg>
        <CandleShape
          x={10}
          width={20}
          wickLow={90}
          wickHigh={110}
          bodyLow={100}
          bodyHigh={105}
          bullish={false}
          yAxis={{ scale: mockScale }}
        />
      </svg>,
    )
    expect(container.querySelector('line')?.getAttribute('stroke')).toBe('#ef5350')
  })

  it('handles equal open and close (doji)', () => {
    const { container } = render(
      <svg>
        <CandleShape
          x={10}
          width={20}
          wickLow={90}
          wickHigh={110}
          bodyLow={100}
          bodyHigh={100}
          bullish={true}
          yAxis={{ scale: mockScale }}
        />
      </svg>,
    )
    const rect = container.querySelector('rect')
    expect(Number(rect?.getAttribute('height'))).toBeGreaterThanOrEqual(1)
  })
})
