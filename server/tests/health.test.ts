import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock pool before importing health router
vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

// We need supertest installed - check if it's available
// If not, we'll test the route directly

import healthRouter from '../src/routes/health.js';

function createApp() {
  const app = express();
  app.use('/health', healthRouter);
  return app;
}

describe('GET /health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return status ok and db true when database is connected', async () => {
    const { query } = await import('../src/db/pool.js');
    vi.mocked(query).mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any);

    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: true });
  });

  it('should return status ok and db false when database is unavailable', async () => {
    const { query } = await import('../src/db/pool.js');
    vi.mocked(query).mockRejectedValueOnce(new Error('Connection refused'));

    const app = createApp();
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: false });
  });
});
