import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireSession } from '../middleware/requireSession.js';

const router = Router();

// --- Validation schemas ---

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['ADMIN', 'ARTIST', 'CLIENT', 'AGENT']),
  workspace_id: z.string().uuid('Invalid workspace ID'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Strip the password_hash field from an account object.
 * Returns a new object safe for serialization to the client.
 */
function stripHash<T extends { password_hash?: unknown }>(account: T): Omit<T, 'password_hash'> {
  const { password_hash: _pw, ...rest } = account;
  void _pw;
  return rest;
}

// --- POST /api/auth/register — Admin only ---

router.post('/register', requireSession, async (req, res) => {
  try {
    if (req.account?.role !== 'ADMIN') {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only admins can create accounts' },
      });
      return;
    }

    const parsed = registerSchema.safeParse(req.body);
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

    const { email, password, name, role, workspace_id } = parsed.data;

    // Check for duplicate email within workspace
    const existing = await query(
      'SELECT id FROM accounts WHERE workspace_id = $1 AND email = $2',
      [workspace_id, email],
    );
    if (existing.rows.length > 0) {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'Email already exists in this workspace' },
      });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await query(
      `INSERT INTO accounts (workspace_id, name, email, role, password_hash, is_api_able)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, workspace_id, name, email, role, is_api_able, created_at`,
      [workspace_id, name, email, role, password_hash, role !== 'CLIENT'],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Registration failed' },
    });
  }
});

// --- POST /api/auth/login ---

router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
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

    const { email, password } = parsed.data;

    const result = await query('SELECT * FROM accounts WHERE email = $1', [
      email,
    ]);
    if (result.rows.length === 0) {
      res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      return;
    }

    const account = result.rows[0];
    const valid = await bcrypt.compare(password, account.password_hash);

    if (!valid) {
      res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      });
      return;
    }

    req.session.accountId = account.id;

    res.json(stripHash(account));
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Login failed' },
    });
  }
});

// --- POST /api/auth/logout ---

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Logout failed' },
      });
      return;
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// --- GET /api/auth/me ---

router.get('/me', requireSession, (req, res) => {
  res.json(stripHash(req.account!));
});

export default router;
