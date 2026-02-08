import { serve } from '@hono/node-server'

import { app } from './app'

const port = Number(process.env.PORT ?? 3001)

serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console -- server startup message
  console.log(`API server listening on http://localhost:${info.port}`)
})
