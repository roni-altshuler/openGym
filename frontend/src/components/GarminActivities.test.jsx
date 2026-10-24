// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import GarminActivities from './GarminActivities.jsx'
import { api } from '../lib/api.js'
vi.mock('../lib/api.js', () => ({ api: vi.fn() }))
vi.mock('./ui.jsx', () => ({ Button: ({ children, size, ...props }) => <button {...props}>{children}</button> }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root
beforeEach(() => { api.mockReset(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); act(() => root.render(<GarminActivities />)) })
afterEach(() => { act(() => root.unmount()); host.remove() })
it('uses the API prefix and clears the key input before sending directly to the authenticated endpoint', async () => {
  api.mockResolvedValueOnce({ configured: false, canConfigure: true }).mockResolvedValueOnce({ configured: true, canConfigure: true })
  await act(async () => host.querySelector('button').click())
  expect(api).toHaveBeenCalledWith('/api/garmin/status')
  const input = host.querySelector('input')
  expect(input.type).toBe('password')
  input.value = 'fixture-only-key'
  await act(async () => { host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); expect(input.value).toBe('') })
  expect(api).toHaveBeenLastCalledWith('/api/garmin/key', { method: 'POST', body: JSON.stringify({ key: 'fixture-only-key' }) })
  expect(host.textContent).toContain('Garmin connected')
  expect(host.textContent).not.toContain('fixture-only-key')
})
