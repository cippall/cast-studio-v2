import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock pool before importing modules
vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

import * as poolModule from '../src/db/pool.js';
import workflowsRouter from '../src/routes/workflows.js';

const mockQuery = vi.mocked(poolModule.query);

const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const AGENT_UUID = 'b0000000-0000-4000-8000-000000000001';
const OTHER_AGENT_UUID = 'b0000000-0000-4000-8000-000000000002';
const WALLET_UUID = 'c0000000-0000-4000-8000-000000000001';
const WORKFLOW_UUID = 'd0000000-0000-4000-8000-000000000001';
const API_KEY_ID = 'e0000000-0000-4000-8000-000000000001';

function makeAgentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: AGENT_UUID,
    workspace_id: WORKSPACE_UUID,
    name: 'Test Agent',
    email: 'agent@studio.com',
    role: 'AGENT',
    is_api_able: true,
    password_hash: '$2a$10$hashedpassword',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeWorkspaceRow() {
  return {
    id: WORKSPACE_UUID,
    name: 'Test Workspace',
    slug: 'test',
    workspace_type: 'STUDIO',
    created_at: '2026-06-17T10:00:00.000Z',
  };
}

function makeWalletRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WALLET_UUID,
    workspace_id: WORKSPACE_UUID,
    account_id: AGENT_UUID,
    balance_credits: '10.00',
    updated_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeWorkflowRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WORKFLOW_UUID,
    workspace_id: WORKSPACE_UUID,
    agent_id: AGENT_UUID,
    wallet_id: WALLET_UUID,
    total_escrow: '0.20',
    consumed_credits: '0.00',
    status: 'RUNNING',
    steps: [
      { task: 'actor_headshot', model: 'flux-pro', status: 'PENDING', outputs: [] },
      { task: 'actor_fullshot', model: 'flux-pro', status: 'PENDING', outputs: [] },
    ],
    error_code: null,
    error_reason: null,
    created_at: '2026-06-17T10:00:00.000Z',
    completed_at: null,
    ...overrides,
  };
}

function seedApiKeyAuth(agent = makeAgentRow()) {
  // Mock: return active API keys
  mockQuery.mockResolvedValueOnce({
    rows: [
      {
        id: API_KEY_ID,
        account_id: agent.id,
        key_hash: '$2a$10$validhashvaluexxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        name: 'Test Key',
        is_active: true,
        created_at: '2026-06-17T10:00:00.000Z',
        last_used_at: null,
      },
    ],
  } as any);

  // Mock: bcrypt.compare will be called - we need to mock it
  // Since bcrypt.compare is called in the middleware, we mock it to return true
  // Actually, the middleware fetches active keys then does bcrypt.compare
  // We can't easily mock bcrypt.compare per-call, so we use a known hash approach
  // Instead, let's mock the query to return the account directly
  // The middleware does: query active keys -> bcrypt.compare -> query account -> query workspace
  // We need to handle the bcrypt.compare call

  // For the account lookup after key match
  mockQuery.mockResolvedValueOnce({ rows: [agent] } as any);
  // Workspace lookup
  mockQuery.mockResolvedValueOnce({ rows: [makeWorkspaceRow()] } as any);
  // last_used_at update (fire-and-forget)
  mockQuery.mockResolvedValueOnce({ rows: [] } as any);
}

function resetMock() {
  mockQuery.mockReset();
}

// We need to mock bcryptjs for the API key middleware
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
  },
  compare: vi.fn().mockResolvedValue(true),
}));

describe('Workflow Endpoints', () => {
  let app: express.Application;

  beforeEach(() => {
    resetMock();
    app = express();
    app.use(express.json());
    app.use('/api/workflows', workflowsRouter);
  });

  // ========================================
  // POST /api/workflows/start
  // ========================================
  describe('POST /api/workflows/start', () => {
    it('should start a workflow with escrow held', async () => {
      seedApiKeyAuth();

      // Mock: findWallet (allowCreate=true)
      mockQuery.mockResolvedValueOnce({
        rows: [makeWalletRow()],
      } as any);

      // Mock: updateWalletBalance (escrow hold)
      mockQuery.mockResolvedValueOnce({
        rows: [makeWalletRow({ balance_credits: '9.80' })],
      } as any);

      // Mock: createLedgerEntry (ESCROW_HOLD)
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'ledger-0001',
            workspace_id: WORKSPACE_UUID,
            wallet_id: WALLET_UUID,
            workflow_id: null,
            api_key_id: null,
            amount: -0.2,
            type: 'ESCROW_HOLD',
            created_at: '2026-06-17T10:00:00.000Z',
          },
        ],
      } as any);

      // Mock: createWorkflow
      mockQuery.mockResolvedValueOnce({
        rows: [makeWorkflowRow()],
      } as any);

      const res = await request(app)
        .post('/api/workflows/start')
        .set('Authorization', 'Bearer cs_live_validkey')
        .send({
          steps: [
            { task: 'actor_headshot', model: 'flux-pro' },
            { task: 'actor_fullshot', model: 'flux-pro' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: WORKFLOW_UUID,
        status: 'RUNNING',
        total_escrow: 0.2,
        consumed_credits: 0,
      });
    });

    it('should return 422 for empty steps array', async () => {
      seedApiKeyAuth();

      const res = await request(app)
        .post('/api/workflows/start')
        .set('Authorization', 'Bearer cs_live_validkey')
        .send({ steps: [] });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 422 for insufficient credits', async () => {
      seedApiKeyAuth();

      // Mock: findWallet with low balance
      mockQuery.mockResolvedValueOnce({
        rows: [makeWalletRow({ balance_credits: '0.05' })],
      } as any);

      const res = await request(app)
        .post('/api/workflows/start')
        .set('Authorization', 'Bearer cs_live_validkey')
        .send({
          steps: [
            { task: 'actor_headshot', model: 'flux-pro' },
            { task: 'actor_fullshot', model: 'flux-pro' },
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('WORKFLOW_ERROR');
    });

    it('should return 401 without API key', async () => {
      const res = await request(app)
        .post('/api/workflows/start')
        .send({
          steps: [{ task: 'actor_headshot', model: 'flux-pro' }],
        });

      expect(res.status).toBe(401);
    });
  });

  // ========================================
  // GET /api/workflows/:id
  // ========================================
  describe('GET /api/workflows/:id', () => {
    it('should return workflow status and step progress', async () => {
      seedApiKeyAuth();

      // Mock: findWorkflowById
      mockQuery.mockResolvedValueOnce({
        rows: [makeWorkflowRow()],
      } as any);

      const res = await request(app)
        .get(`/api/workflows/${WORKFLOW_UUID}`)
        .set('Authorization', 'Bearer cs_live_validkey');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: WORKFLOW_UUID,
        status: 'RUNNING',
        total_escrow: 0.2,
        consumed_credits: 0,
      });
      expect(res.body.steps).toHaveLength(2);
      expect(res.body.steps[0].task).toBe('actor_headshot');
    });

    it('should return 404 for non-existent workflow', async () => {
      seedApiKeyAuth();

      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .get('/api/workflows/00000000-0000-4000-8000-000000000000')
        .set('Authorization', 'Bearer cs_live_validkey');

      expect(res.status).toBe(404);
    });

    it('should return 403 for workflow owned by another agent', async () => {
      seedApiKeyAuth();

      mockQuery.mockResolvedValueOnce({
        rows: [makeWorkflowRow({ agent_id: OTHER_AGENT_UUID })],
      } as any);

      const res = await request(app)
        .get(`/api/workflows/${WORKFLOW_UUID}`)
        .set('Authorization', 'Bearer cs_live_validkey');

      expect(res.status).toBe(403);
    });
  });

  // ========================================
  // POST /api/workflows/:id/cancel
  // ========================================
  describe('POST /api/workflows/:id/cancel', () => {
    it('should cancel workflow and refund unconsumed escrow', async () => {
      seedApiKeyAuth();

      // Mock: findWorkflowById (RUNNING workflow)
      mockQuery.mockResolvedValueOnce({
        rows: [makeWorkflowRow({ consumed_credits: '0.05' })],
      } as any);

      // Mock: findWallet for refund
      mockQuery.mockResolvedValueOnce({
        rows: [makeWalletRow({ balance_credits: '9.80' })],
      } as any);

      // Mock: updateWalletBalance (refund)
      mockQuery.mockResolvedValueOnce({
        rows: [makeWalletRow({ balance_credits: '9.95' })],
      } as any);

      // Mock: createLedgerEntry (ESCROW_REFUND)
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'ledger-0002',
            workspace_id: WORKSPACE_UUID,
            wallet_id: WALLET_UUID,
            workflow_id: WORKFLOW_UUID,
            api_key_id: null,
            amount: 0.15,
            type: 'ESCROW_REFUND',
            created_at: '2026-06-17T10:00:00.000Z',
          },
        ],
      } as any);

      // Mock: updateWorkflowStatus (mark as FAILED)
      mockQuery.mockResolvedValueOnce({
        rows: [
          makeWorkflowRow({
            status: 'FAILED',
            consumed_credits: '0.05',
            error_code: 'CANCELLED',
            error_reason: 'Workflow cancelled by agent',
          }),
        ],
      } as any);

      const res = await request(app)
        .post(`/api/workflows/${WORKFLOW_UUID}/cancel`)
        .set('Authorization', 'Bearer cs_live_validkey');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: WORKFLOW_UUID,
        status: 'FAILED',
        refunded_credits: 0.15,
      });
    });

    it('should return 409 for already completed workflow', async () => {
      seedApiKeyAuth();

      mockQuery.mockResolvedValueOnce({
        rows: [makeWorkflowRow({ status: 'COMPLETED' })],
      } as any);

      const res = await request(app)
        .post(`/api/workflows/${WORKFLOW_UUID}/cancel`)
        .set('Authorization', 'Bearer cs_live_validkey');

      expect(res.status).toBe(409);
    });

    it('should return 404 for non-existent workflow', async () => {
      seedApiKeyAuth();

      mockQuery.mockResolvedValueOnce({ rows: [] } as any);

      const res = await request(app)
        .post('/api/workflows/00000000-0000-4000-8000-000000000000/cancel')
        .set('Authorization', 'Bearer cs_live_validkey');

      expect(res.status).toBe(404);
    });

    it('should return 403 for workflow owned by another agent', async () => {
      seedApiKeyAuth();

      mockQuery.mockResolvedValueOnce({
        rows: [makeWorkflowRow({ agent_id: OTHER_AGENT_UUID })],
      } as any);

      const res = await request(app)
        .post(`/api/workflows/${WORKFLOW_UUID}/cancel`)
        .set('Authorization', 'Bearer cs_live_validkey');

      expect(res.status).toBe(403);
    });
  });

  // ========================================
  // Escrow verification
  // ========================================
  describe('Escrow lifecycle', () => {
    it('should hold escrow on start and fully refund on cancel with no consumption', async () => {
      // Start workflow
      seedApiKeyAuth();

      mockQuery.mockResolvedValueOnce({ rows: [makeWalletRow()] } as any);
      mockQuery.mockResolvedValueOnce({
        rows: [makeWalletRow({ balance_credits: '9.80' })],
      } as any);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'ledger-0001',
            workspace_id: WORKSPACE_UUID,
            wallet_id: WALLET_UUID,
            workflow_id: null,
            api_key_id: null,
            amount: -0.2,
            type: 'ESCROW_HOLD',
            created_at: '2026-06-17T10:00:00.000Z',
          },
        ],
      } as any);
      mockQuery.mockResolvedValueOnce({
        rows: [makeWorkflowRow()],
      } as any);

      const startRes = await request(app)
        .post('/api/workflows/start')
        .set('Authorization', 'Bearer cs_live_validkey')
        .send({
          steps: [
            { task: 'actor_headshot', model: 'flux-pro' },
            { task: 'actor_fullshot', model: 'flux-pro' },
          ],
        });

      expect(startRes.status).toBe(201);
      expect(startRes.body.total_escrow).toBe(0.2);

      resetMock();

      // Cancel workflow - full refund since nothing consumed
      seedApiKeyAuth();

      mockQuery.mockResolvedValueOnce({
        rows: [makeWorkflowRow({ consumed_credits: '0.00' })],
      } as any);
      mockQuery.mockResolvedValueOnce({
        rows: [makeWalletRow({ balance_credits: '9.80' })],
      } as any);
      mockQuery.mockResolvedValueOnce({
        rows: [makeWalletRow({ balance_credits: '10.00' })],
      } as any);
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'ledger-0002',
            workspace_id: WORKSPACE_UUID,
            wallet_id: WALLET_UUID,
            workflow_id: WORKFLOW_UUID,
            api_key_id: null,
            amount: 0.2,
            type: 'ESCROW_REFUND',
            created_at: '2026-06-17T10:00:00.000Z',
          },
        ],
      } as any);
      mockQuery.mockResolvedValueOnce({
        rows: [
          makeWorkflowRow({
            status: 'FAILED',
            error_code: 'CANCELLED',
            error_reason: 'Workflow cancelled by agent',
          }),
        ],
      } as any);

      const cancelRes = await request(app)
        .post(`/api/workflows/${WORKFLOW_UUID}/cancel`)
        .set('Authorization', 'Bearer cs_live_validkey');

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.refunded_credits).toBe(0.2);
    });
  });
});
