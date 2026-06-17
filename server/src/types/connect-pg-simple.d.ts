// Type declarations for connect-pg-simple
// https://www.npmjs.com/package/connect-pg-simple

declare module 'connect-pg-simple' {
  import { Store } from 'express-session';
  import { Pool } from 'pg';

  interface PgSessionOptions {
    pool?: Pool;
    tableName?: string;
    conString?: string;
    conObject?: Record<string, unknown>;
    ttl?: number;
    createTableIfMissing?: boolean;
    pruneSessionInterval?: number;
    schemaName?: string;
    errorLog?: (...args: unknown[]) => void;
  }

  interface PgStore extends Store {
    close(): void;
    pruneSessions(): void;
  }

  interface PgSessionFactory {
    (session: typeof import('express-session')): new (options?: PgSessionOptions) => PgStore;
  }

  const connectPgSimple: PgSessionFactory;
  export default connectPgSimple;
}
