import { Router } from 'express';
import { z } from 'zod';
import { requireSession } from '../middleware/requireSession.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import type { Request, Response } from 'express';
import * as commissionService from '../services/commission-service.js';

const router = Router();

// --- Zod schemas ---

const createCommissionSchema = z.object({
  title: z.string().min(1, 'title is required').max(255),
  brief: z.record(z.string(), z.unknown()),
});

const assignSchema = z.object({
  assignee_id: z.string().uuid('assignee_id must be a valid UUID'),
});

const validStatuses = [
  'REQUESTED',
  'ASSIGNED',
  'IN_PROGRESS',
  'SUBMITTED',
  'CHANGES_REQUESTED',
  'APPROVED',
  'CANCELLED',
] as const;

const statusTransitionSchema = z.object({
  status: z.enum(validStatuses),
  premium_cost: z.number().positive().optional(),
  asset_ids: z.array(z.string().uuid()).min(1).optional(),
});

// --- POST /api/commissions — create commission ---

router.post('/', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const parsed = createCommissionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const commission = await commissionService.createCommissionRequest(parsed.data, req.account!);
    res.status(201).json(commission);
  } catch (err) {
    console.error('Create commission error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create commission' },
    });
  }
});

// --- GET /api/commissions — list commissions ---

router.get('/', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const sortBy = (req.query.sortBy as string) || 'created_at';
    const sortOrder = ((req.query.sortOrder as string) || 'desc') as 'asc' | 'desc';
    const status = req.query.status as string | undefined;
    const adminBypass = req.account?.role === 'ADMIN';

    const result = await commissionService.listCommissionRequests(
      { status, page, pageSize, sortBy, sortOrder },
      req.account!,
      adminBypass,
    );

    res.json(result);
  } catch (err) {
    console.error('List commissions error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to list commissions' },
    });
  }
});

// --- GET /api/commissions/:id — get commission detail ---

router.get('/:id', requireSession, requireWorkspace, async (req: Request, res: Response) => {
  try {
    const adminBypass = req.account?.role === 'ADMIN';
    const commission = await commissionService.getCommissionDetail(
      req.params.id,
      req.account!,
      adminBypass,
    );

    if (!commission) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Commission not found' },
      });
      return;
    }

    res.json(commission);
  } catch (err) {
    console.error('Get commission error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get commission' },
    });
  }
});

// --- PATCH /api/commissions/:id/assign — Admin assigns to Artist ---

router.patch(
  '/:id/assign',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const parsed = assignSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parsed.error.flatten().fieldErrors,
          },
        });
        return;
      }

      const adminBypass = req.account?.role === 'ADMIN';

      // Only admin can assign
      if (!adminBypass) {
        res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Only admins can assign commissions' },
        });
        return;
      }

      const commission = await commissionService.assignCommissionToArtist(
        req.params.id,
        parsed.data.assignee_id,
        req.account!,
        adminBypass,
      );

      res.json(commission);
    } catch (err) {
      if (err instanceof commissionService.InvalidTransitionError) {
        res.status(409).json({
          error: { code: 'INVALID_TRANSITION', message: err.message },
        });
        return;
      }
      if (err instanceof Error && err.message === 'Commission not found') {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Commission not found' },
        });
        return;
      }
      console.error('Assign commission error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to assign commission' },
      });
    }
  },
);

// --- PATCH /api/commissions/:id/status — transition status ---

router.patch(
  '/:id/status',
  requireSession,
  requireWorkspace,
  async (req: Request, res: Response) => {
    try {
      const parsed = statusTransitionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(422).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input',
            details: parsed.error.flatten().fieldErrors,
          },
        });
        return;
      }

      const adminBypass = req.account?.role === 'ADMIN';
      const { status, premium_cost, asset_ids } = parsed.data;

      // For SUBMITTED, premium_cost and asset_ids are required
      if (status === 'SUBMITTED') {
        if (!premium_cost || premium_cost <= 0) {
          res.status(422).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Premium cost is required and must be greater than 0 when submitting work',
            },
          });
          return;
        }
        if (!asset_ids || asset_ids.length === 0) {
          res.status(422).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'At least one asset_id is required when submitting work',
            },
          });
          return;
        }
      }

      const commission = await commissionService.transitionCommissionStatus(
        req.params.id,
        status,
        req.account!,
        { premium_cost, asset_ids },
        adminBypass,
      );

      res.json(commission);
    } catch (err) {
      if (err instanceof commissionService.InvalidTransitionError) {
        res.status(409).json({
          error: { code: 'INVALID_TRANSITION', message: err.message },
        });
        return;
      }
      if (err instanceof commissionService.PermissionDeniedError) {
        res.status(403).json({
          error: { code: 'FORBIDDEN', message: err.message },
        });
        return;
      }
      if (err instanceof Error && err.message === 'Commission not found') {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Commission not found' },
        });
        return;
      }
      console.error('Status transition error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update commission status' },
      });
    }
  },
);

export default router;
