import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (overrides existing env vars)
const envPath = path.resolve(import.meta.dirname, '../../.env');
const dotenvResult = dotenv.config({ path: envPath });
// Force-override with .env values so DATABASE_URL with credentials wins
if (dotenvResult.parsed) {
  for (const [key, value] of Object.entries(dotenvResult.parsed)) {
    process.env[key] = value;
  }
}

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Prefer DATABASE_URL if set, otherwise build from individual vars
function buildDbConfig(): DbConfig {
  if (process.env.DATABASE_URL) {
    return parseDatabaseUrl(process.env.DATABASE_URL);
  }

  return {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: getEnvOrThrow('PGDATABASE'),
    user: getEnvOrThrow('PGUSER'),
    password: getEnvOrThrow('PGPASSWORD'),
    max: parseInt(process.env.PGPOOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.PGIDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.PGCONNECT_TIMEOUT || '5000', 10),
  };
}

function parseDatabaseUrl(url: string): DbConfig {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432', 10),
    database: parsed.pathname.replace(/^\//, ''),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    max: parseInt(process.env.PGPOOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.PGIDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.PGCONNECT_TIMEOUT || '5000', 10),
  };
}

export const dbConfig = buildDbConfig();
