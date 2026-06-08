import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import AssetSelector from './AssetSelector'
import { useMarketStore } from '../stores/useMarketStore'

const symbols = [
  { sym: 'AAPL', description: 'Apple Inc.' },
  { sym: 'MSFT', description: 'Microsoft Corp.' },
]

beforeEach(() => useMarketStore.setState({ selectedAsset: 'AAPL', granularity: '1m', candles: [] }))

describe('AssetSelector', () => {
  it('renders all symbols as options', () => {
    render(<AssetSelector symbols={symbols} />)
    expect(screen.getByText('AAPL — Apple Inc.')).toBeInTheDocument()
    expect(screen.getByText('MSFT — Microsoft Corp.')).toBeInTheDocument()
  })

  it('updates store when symbol changes', () => {
    render(<AssetSelector symbols={symbols} />)
    const select = screen.getAllByRole('combobox')[0]
    fireEvent.change(select, { target: { value: 'MSFT' } })
    expect(useMarketStore.getState().selectedAsset).toBe('MSFT')
  })

  it('updates store when granularity changes', () => {
    render(<AssetSelector symbols={symbols} />)
    const select = screen.getAllByRole('combobox')[1]
    fireEvent.change(select, { target: { value: '5m' } })
    expect(useMarketStore.getState().granularity).toBe('5m')
  })

  it('shows all granularity options', () => {
    render(<AssetSelector symbols={symbols} />)
    expect(screen.getByText('1m')).toBeInTheDocument()
    expect(screen.getByText('1d')).toBeInTheDocument()
  })
})
