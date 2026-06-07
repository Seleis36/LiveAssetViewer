import { describe, it, expect, beforeEach } from 'vitest'
import { useConnectionStore } from './useConnectionStore'

beforeEach(() => {
  useConnectionStore.setState({ status: 'closed' })
})

describe('useConnectionStore', () => {
  it('starts as closed', () => {
    expect(useConnectionStore.getState().status).toBe('closed')
  })

  it('setStatus updates the status', () => {
    useConnectionStore.getState().setStatus('open')
    expect(useConnectionStore.getState().status).toBe('open')
  })
})
