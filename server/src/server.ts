import express from 'express';
import path from 'node:path';
import cors from 'cors';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pool from './db/pool.js';
import { query } from './db/pool.js';
import { requireSession } from './middleware/requireSession.js';
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
import walletRouter from './routes/wallet.js';
import notificationsRouter from './routes/notifications.js';
import workflowsRouter from './routes/workflows.js';
import { stripeWebhookHandler } from './routes/wallet.js';
import uploadRouter from './routes/upload.js';
import marketplaceRouter from './routes/marketplace.js';
import adminMarketplaceRouter from './routes/admin/marketplace.js';
import adminRouter from './routes/admin/admin.js';
import agentMarketplaceRouter from './routes/agent/marketplace.js';
import activityRouter from './routes/activity.js';
import collectionsRouter from './routes/collections.js';
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
app.use('/api/wallet', walletRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/workflows', workflowsRouter);

// Stripe webhook needs raw body for signature verification
app.post(
  '/api/wallet/stripe-webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler,
);

// Static file serving for uploaded images
const uploadsDir = process.env.UPLOAD_DIR || path.resolve('uploads');
app.use('/uploads', express.static(uploadsDir));

// Upload route
app.use('/api/upload', uploadRouter);
app.use('/api/marketplace', marketplaceRouter);
app.use('/api/admin/marketplace', adminMarketplaceRouter);
app.use('/api/admin', adminRouter);
app.use('/api/agent/marketplace', agentMarketplaceRouter);
app.use('/api', activityRouter);
app.use('/api/collections', collectionsRouter);

// Dashboard stats (admin only)
app.get('/api/dashboard', requireSession, async (req, res) => {
  try {
    if (req.account?.role !== 'ADMIN') {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Admin access required' } });
      return;
    }
    const [actors, looks, items, members, pendingCommissions] = await Promise.all([
      query("SELECT COUNT(*)::int AS count FROM assets WHERE asset_type = 'ACTOR'"),
      query("SELECT COUNT(*)::int AS count FROM assets WHERE asset_type = 'LOOK'"),
      query("SELECT COUNT(*)::int AS count FROM assets WHERE asset_type = 'FASHION_ITEM'"),
      query('SELECT COUNT(*)::int AS count FROM accounts'),
      query(
        "SELECT COUNT(*)::int AS count FROM commissions WHERE status IN ('REQUESTED','IN_PROGRESS','SUBMITTED')",
      ),
    ]);
    res.json({
      totalActors: actors.rows[0]?.count ?? 0,
      totalLooks: looks.rows[0]?.count ?? 0,
      totalFashionItems: items.rows[0]?.count ?? 0,
      activeMembers: members.rows[0]?.count ?? 0,
      pendingCommissions: pendingCommissions.rows[0]?.count ?? 0,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load dashboard' } });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  startWorker();
});

export default app;
