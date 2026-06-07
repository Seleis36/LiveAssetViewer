import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the app header', () => {
    render(<App />)
    expect(screen.getByText('LiveAssetViewer')).toBeInTheDocument()
  })

  it('renders the symbol and granularity selectors', () => {
    render(<App />)
    expect(screen.getAllByText('Symbol').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Granularity').length).toBeGreaterThan(0)
  })
})
