import { Router, type Request, type Response } from 'express';
import { requireSession } from '../middleware/requireSession.js';
import { query } from '../db/pool.js';

const router = Router();

router.get('/dashboard', requireSession, async (req: Request, res: Response) => {
  try {
    const role = req.account?.role;

    if (role === 'ADMIN') {
      const workspaceId = req.account!.workspace_id;
      const [actors, looks, items, members, pendingCommissions] = await Promise.all([
        query(
          "SELECT COUNT(*)::int AS count FROM assets WHERE asset_type = 'ACTOR' AND workspace_id = $1 AND deleted_at IS NULL",
          [workspaceId],
        ),
        query(
          "SELECT COUNT(*)::int AS count FROM assets WHERE asset_type = 'LOOK' AND workspace_id = $1 AND deleted_at IS NULL",
          [workspaceId],
        ),
        query(
          "SELECT COUNT(*)::int AS count FROM assets WHERE asset_type = 'FASHION_ITEM' AND workspace_id = $1 AND deleted_at IS NULL",
          [workspaceId],
        ),
        query('SELECT COUNT(*)::int AS count FROM accounts WHERE workspace_id = $1', [workspaceId]),
        query(
          "SELECT COUNT(*)::int AS count FROM commissions WHERE workspace_id = $1 AND status IN ('REQUESTED','IN_PROGRESS','SUBMITTED')",
          [workspaceId],
        ),
      ]);
      res.json({
        totalActors: actors.rows[0]?.count ?? 0,
        totalLooks: looks.rows[0]?.count ?? 0,
        totalFashionItems: items.rows[0]?.count ?? 0,
        activeMembers: members.rows[0]?.count ?? 0,
        pendingCommissions: pendingCommissions.rows[0]?.count ?? 0,
      });
      return;
    }

    if (role === 'ARTIST') {
      const accountId = req.account!.id;
      const [actors, looks, items, recentSubs] = await Promise.all([
        query(
          "SELECT COUNT(*)::int AS count FROM assets WHERE asset_type = 'ACTOR' AND creator_id = $1 AND deleted_at IS NULL",
          [accountId],
        ),
        query(
          "SELECT COUNT(*)::int AS count FROM assets WHERE asset_type = 'LOOK' AND creator_id = $1 AND deleted_at IS NULL",
          [accountId],
        ),
        query(
          "SELECT COUNT(*)::int AS count FROM assets WHERE asset_type = 'FASHION_ITEM' AND creator_id = $1 AND deleted_at IS NULL",
          [accountId],
        ),
        query(
          `SELECT a.id, a.asset_type, a.name,
                  COALESCE(
                    (SELECT ao.image_url FROM asset_outputs ao
                     WHERE ao.asset_id = a.id AND ao.status = 'SUCCESS'
                     ORDER BY ao.created_at ASC LIMIT 1),
                    NULL
                  ) AS thumbnail_url,
                  'Generated' AS action, a.created_at
           FROM assets a
           WHERE a.creator_id = $1 AND a.deleted_at IS NULL
           ORDER BY a.created_at DESC LIMIT 5`,
          [accountId],
        ),
      ]);
      res.json({
        myActors: actors.rows[0]?.count ?? 0,
        myLooks: looks.rows[0]?.count ?? 0,
        myItems: items.rows[0]?.count ?? 0,
        recentSubmissions: recentSubs.rows,
      });
      return;
    }

    if (role === 'CLIENT') {
      const accountId = req.account!.id;
      const workspaceId = req.account!.workspace_id;
      const [wallet, activeComms, recentPurchases] = await Promise.all([
        query('SELECT balance_credits FROM wallets WHERE account_id = $1 AND workspace_id = $2', [
          accountId,
          workspaceId,
        ]),
        query(
          "SELECT COUNT(*)::int AS count FROM commissions WHERE client_id = $1 AND status IN ('REQUESTED','IN_PROGRESS','SUBMITTED')",
          [accountId],
        ),
        query(
          `SELECT a.id, a.asset_type, a.name,
                  COALESCE(
                    (SELECT ao.image_url FROM asset_outputs ao
                     WHERE ao.asset_id = a.id AND ao.status = 'SUCCESS'
                     ORDER BY ao.created_at ASC LIMIT 1),
                    NULL
                  ) AS thumbnail_url,
                  'Purchased' AS action, a.sold_at AS created_at
           FROM assets a
           WHERE a.client_id = $1 AND a.deleted_at IS NULL AND a.sold_at IS NOT NULL
           ORDER BY a.sold_at DESC LIMIT 5`,
          [accountId],
        ),
      ]);
      res.json({
        walletBalance: wallet.rows[0]?.balance_credits ?? 0,
        activeCommissions: activeComms.rows[0]?.count ?? 0,
        recentPurchases: recentPurchases.rows,
      });
      return;
    }

    res.json({});
  } catch (err) {
    console.error('Dashboard error:', err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load dashboard' } });
  }
});

export default router;
