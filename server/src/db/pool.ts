import pg from 'pg';
import { dbConfig } from './config.js';

const pool = new pg.Pool(dbConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

export async function query(text: string, params?: unknown[]): Promise<pg.QueryResult> {
  return pool.query(text, params);
}

export async function getClient(): Promise<pg.PoolClient> {
  return pool.connect();
}

export default pool;
