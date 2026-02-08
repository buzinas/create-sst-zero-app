import pg from 'pg'
import { Resource } from 'sst'

const pool = new pg.Pool({
  host: Resource.Database.host,
  port: Resource.Database.port,
  user: Resource.Database.username,
  password: Resource.Database.password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

export async function handler(event: {
  action: 'create' | 'drop'
  database: string
}) {
  const client = await pool.connect()

  try {
    if (event.action === 'create') {
      const { rows } = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [event.database],
      )
      if (rows.length === 0) {
        await client.query(`CREATE DATABASE "${event.database}"`)
      }
    } else if (event.action === 'drop') {
      await client.query(
        `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
         WHERE datname = $1`,
        [event.database],
      )
      await client.query(`DROP DATABASE IF EXISTS "${event.database}"`)
    }

    return {
      ok: true,
      action: event.action,
      database: event.database,
    }
  } finally {
    client.release()
  }
}
