import { Router, type Request, type Response } from 'express';
import { requireSession } from '../middleware/requireSession.js';
import { query } from '../db/pool.js';

const router = Router();

/**
 * GET /api/activity?limit=10
 * Returns recent activity feed for the authenticated user.
 * Combines asset creation and asset output generation events,
 * ordered by most recent first.
 */
router.get('/activity', requireSession, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);
    const accountId = req.account?.id;
    const workspaceId = req.account?.workspace_id;

    // Recent assets created by or shared with this user
    const assetsResult = await query(
      `SELECT
         a.id,
         a.asset_type,
         a.name AS asset_name,
         a.created_at,
         'Created' AS action,
         COALESCE(
           (SELECT ao.image_url FROM asset_outputs ao
            WHERE ao.asset_id = a.id AND ao.status = 'SUCCESS'
            ORDER BY ao.created_at ASC LIMIT 1),
           NULL
         ) AS thumbnail_url
       FROM assets a
       WHERE a.creator_id = $1 AND a.workspace_id = $2 AND a.deleted_at IS NULL
       ORDER BY a.created_at DESC
       LIMIT $3`,
      [accountId, workspaceId, limit],
    );

    // Recent successful generations (outputs) for this user's assets
    const outputsResult = await query(
      `SELECT
         ao.id::text AS id,
         a.asset_type,
         a.name AS asset_name,
         ao.created_at,
         'Generated' AS action,
         ao.image_url AS thumbnail_url
       FROM asset_outputs ao
       JOIN assets a ON a.id = ao.asset_id
       WHERE a.creator_id = $1 AND a.workspace_id = $2 AND ao.status = 'SUCCESS' AND a.deleted_at IS NULL
       ORDER BY ao.created_at DESC
       LIMIT $3`,
      [accountId, workspaceId, limit],
    );

    // Recent shares where this user is the grantee
    const sharesResult = await query(
      `SELECT
         a.id,
         a.asset_type,
         a.name AS asset_name,
         ap.granted_at AS created_at,
         'Shared' AS action,
         COALESCE(
           (SELECT ao.image_url FROM asset_outputs ao
            WHERE ao.asset_id = a.id AND ao.status = 'SUCCESS'
            ORDER BY ao.created_at ASC LIMIT 1),
           NULL
         ) AS thumbnail_url
       FROM asset_permissions ap
       JOIN assets a ON a.id = ap.asset_id
       WHERE ap.grantee_id = $1 AND a.workspace_id = $2 AND ap.revoked_at IS NULL AND a.deleted_at IS NULL
       ORDER BY ap.granted_at DESC
       LIMIT $3`,
      [accountId, workspaceId, limit],
    );

    // Merge, sort by created_at desc, and cap at limit
    const all = [...assetsResult.rows, ...outputsResult.rows, ...sharesResult.rows]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    res.json(all);
  } catch (err) {
    console.error('Activity feed error:', err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load activity feed' } });
  }
});

export default router;
