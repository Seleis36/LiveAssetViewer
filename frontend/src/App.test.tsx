import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from './App'

vi.mock('./services/wsClient', () => ({
  wsClient: {
    connect: vi.fn(),
    subscribe: vi.fn(),
    destroy: vi.fn(),
  },
}))

vi.mock('./api/client', () => ({
  fetchSymbols: vi.fn().mockResolvedValue([
    { sym: 'AAPL', description: 'Apple Inc.' },
  ]),
  fetchHistory: vi.fn().mockResolvedValue([]),
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the app header', async () => {
    render(<App />)
    expect(screen.getByText('LiveAssetViewer')).toBeInTheDocument()
  })

  it('shows loading state initially', () => {
    render(<App />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders symbols selector after data loads', async () => {
    render(<App />)
    await waitFor(() => expect(screen.queryByText('Loading…')).not.toBeInTheDocument())
    expect(screen.getByText('AAPL — Apple Inc.')).toBeInTheDocument()
  })

  it('shows ConnectionIndicator', async () => {
    render(<App />)
    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })

  it('shows error when fetchSymbols fails', async () => {
    const { fetchSymbols } = await import('./api/client')
    vi.mocked(fetchSymbols).mockRejectedValueOnce(new Error('network'))
    render(<App />)
    await waitFor(() => expect(screen.getByText('Failed to load symbols')).toBeInTheDocument())
  })
})
