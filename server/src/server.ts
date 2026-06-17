import express from 'express';
import path from 'node:path';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pool from './db/pool.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import apiKeysRouter from './routes/apiKeys.js';
import accountsRouter from './routes/accounts.js';
import workspacesRouter from './routes/workspaces.js';
import actorsRouter from './routes/actors.js';
import sharingRouter from './routes/sharing.js';
import commissionsRouter from './routes/commissions.js';
import looksRouter from './routes/looks.js';
import fashionItemsRouter from './routes/fashion-items.js';
import generationJobsRouter from './routes/generation-jobs.js';
import assetVersionsRouter from './routes/asset-versions.js';
import uploadRouter from './routes/upload.js';
import { startWorker } from './workers/generation-worker.js';

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
app.use('/api/actors', actorsRouter);
app.use('/api', sharingRouter);
app.use('/api/looks', looksRouter);
app.use('/api/fashion-items', fashionItemsRouter);
app.use('/api/commissions', commissionsRouter);
app.use('/api/generation-jobs', generationJobsRouter);
app.use('/api/assets', assetVersionsRouter);

// Static file serving for uploaded images
const uploadsDir = process.env.UPLOAD_DIR || path.resolve('uploads');
app.use('/uploads', express.static(uploadsDir));

// Upload route
app.use('/api/upload', uploadRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startWorker();
});

export default app;
