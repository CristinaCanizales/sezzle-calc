import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import { messages } from './messages'

describe('App', () => {
  it('renders the page shell around the calculator', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: messages.app.title })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: messages.app.sezzleLogoAlt })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: messages.calculator.label })).toBeInTheDocument()
  })

  it('lists every keyboard shortcut from messages', () => {
    render(<App />)

    for (const { keys } of messages.shortcuts.groups) {
      for (const key of keys) expect(screen.getByText(key, { selector: 'kbd' })).toBeInTheDocument()
    }
  })
})
