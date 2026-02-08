import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

import Home from './home'

vi.mock('@rocicorp/zero/react', () => ({
  useConnectionState: () => ({ name: 'connected' }),
}))

test('renders app name and connection status', () => {
  render(<Home />)
  expect(screen.getByText('Hello, Zero App!')).toBeInTheDocument()
  expect(screen.getByText('Zero: connected')).toBeInTheDocument()
})
