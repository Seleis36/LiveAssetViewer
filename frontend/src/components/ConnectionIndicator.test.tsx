import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { ConnectionIndicator } from './ConnectionIndicator'
import { useConnectionStore } from '../stores/useConnectionStore'

beforeEach(() => useConnectionStore.setState({ status: 'closed' }))

describe('ConnectionIndicator', () => {
  it('shows Disconnected when status is closed', () => {
    render(<ConnectionIndicator />)
    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })

  it('shows Connected when status is open', () => {
    useConnectionStore.setState({ status: 'open' })
    render(<ConnectionIndicator />)
    expect(screen.getByText('Connected')).toBeInTheDocument()
  })

  it('shows Connecting when status is connecting', () => {
    useConnectionStore.setState({ status: 'connecting' })
    render(<ConnectionIndicator />)
    expect(screen.getByText('Connecting…')).toBeInTheDocument()
  })

  it('shows Error when status is error', () => {
    useConnectionStore.setState({ status: 'error' })
    render(<ConnectionIndicator />)
    expect(screen.getByText('Error')).toBeInTheDocument()
  })
})
