import { Router } from 'express';
import { requireSession } from '../middleware/requireSession.js';
import { requireWorkspace } from '../middleware/requireWorkspace.js';
import { z } from 'zod';
import type { Request, Response } from 'express';
import * as walletService from '../services/wallet-service.js';
import { StripeWebhookNotFoundError } from '../errors/stripe-error.js';

const router = Router();

const walletTopUpSchema = z.object({ amount: z.number().positive('amount must be positive') });

async function getWallet(req: Request, res: Response) {
  try {
    const balance = await walletService.getWalletBalance(req.account!, req.workspace!);
    res.json(balance);
  } catch (err) {
    console.error('Get wallet error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load wallet' } });
  }
}

async function topUpWallet(req: Request, res: Response) {
  try {
    const parsed = walletTopUpSchema.safeParse(req.body);
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

    const result = await walletService.createStripeTopUp(
      req.account!,
      req.workspace!,
      parsed.data,
      `${req.protocol}://${req.get('host')}`,
    );
    res.json(result);
  } catch (err) {
    console.error('Top-up wallet error:', err);
    const status =
      err && typeof err === 'object' && 'statusCode' in err
        ? (err as { statusCode: number }).statusCode
        : 500;
    res.status(status).json({ error: { code: 'WALLET_ERROR', message: (err as Error).message } });
  }
}

async function listTransactions(req: Request, res: Response) {
  try {
    const result = await walletService.listLedgerTransactions(req.account!, req.workspace!, {
      type: req.query.type as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error('List ledger transactions error:', err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to load transactions' } });
  }
}

router.get('/', requireSession, requireWorkspace, getWallet);
router.post('/top-up', requireSession, requireWorkspace, topUpWallet);
router.get('/transactions', requireSession, requireWorkspace, listTransactions);

export async function handleStripeWebhook(req: Request, res: Response) {
  try {
    const payload =
      (req as Request & { rawBody?: Buffer }).rawBody?.toString() ?? JSON.stringify(req.body);
    const signature = String(req.headers['stripe-signature'] ?? '');
    await walletService.handleStripeWebhook(payload, signature, req.workspace?.id ?? 'global');
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err);
    if (err instanceof StripeWebhookNotFoundError) {
      res.status(500).json({ error: { code: 'STRIPE_ERROR', message: err.message } });
      return;
    }
    res
      .status(400)
      .json({ error: { code: 'STRIPE_WEBHOOK_ERROR', message: (err as Error).message } });
  }
}

export default router;
export { handleStripeWebhook as stripeWebhookHandler };
