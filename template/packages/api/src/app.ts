import { Hono } from 'hono'

const app = new Hono()

app.get('/health', (c) => c.json({ ok: true, version: '0.1.0' }))

app.post('/api/zero/query', async (c) => {
  // TODO: wire up handleQueryRequest with queries + dbProvider
  return c.json({ error: 'not implemented' }, 501)
})

app.post('/api/zero/mutate', async (c) => {
  // TODO: wire up handleMutateRequest with mutators + dbProvider
  return c.json({ error: 'not implemented' }, 501)
})

export { app }
