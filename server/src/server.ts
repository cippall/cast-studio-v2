import express from 'express';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pool from './db/pool.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import apiKeysRouter from './routes/apiKeys.js';
import accountsRouter from './routes/accounts.js';
import workspacesRouter from './routes/workspaces.js';

const app = express();
const PORT = 3001;

const PgSession = connectPgSimple(session);

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

// Session middleware
app.use(
  session({
    store: new PgSession({
      pool,
      tableName: 'session',
    }),
    secret: process.env.SESSION_SECRET || 'cast-studio-dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
);

// Routes
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/api-keys', apiKeysRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/workspaces', workspacesRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
