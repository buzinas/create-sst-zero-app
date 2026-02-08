import { describe, expect, test } from 'vitest'

import { app } from './app'

describe('health endpoint', () => {
  test('GET /health returns ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body).toEqual({ ok: true, version: '0.1.0' })
  })
})
