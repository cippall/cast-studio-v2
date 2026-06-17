import { Router } from 'express';
import { query } from '../db/pool.js';

const router = Router();

router.get('/', async (_req, res) => {
  let db = false;

  try {
    await query('SELECT 1');
    db = true;
  } catch {
    db = false;
  }

  res.json({ status: 'ok', db });
});

export default router;
