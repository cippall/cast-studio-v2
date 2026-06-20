import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import path from 'node:path';
import fs from 'node:fs';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock pool before importing modules that use it
vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

import * as poolModule from '../src/db/pool.js';
import { LocalStorageProvider } from '../src/services/storage/local-storage.js';
import uploadRouter from '../src/routes/upload.js';

const mockQuery = vi.mocked(poolModule.query);

// Valid UUIDs
const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ARTIST_UUID = 'b0000000-0000-4000-8000-000000000001';

// --- Factories ---

function makeAccountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ARTIST_UUID,
    workspace_id: WORKSPACE_UUID,
    name: 'Test Artist',
    email: 'artist@studio.com',
    role: 'ARTIST',
    is_api_able: true,
    password_hash: '$2a$10$hashedpassword',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

function makeWorkspaceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: WORKSPACE_UUID,
    name: 'Test Workspace',
    slug: 'test-workspace',
    workspace_type: 'STUDIO',
    created_at: '2026-06-17T10:00:00.000Z',
    ...overrides,
  };
}

// --- Test directories ---

const TEST_UPLOAD_DIR = path.resolve('/tmp/test-cast-uploads');

// --- Storage provider tests ---

describe('LocalStorageProvider', () => {
  const provider = new LocalStorageProvider(TEST_UPLOAD_DIR);
  const testKey = `ref_test-asset_1_abc12345.png`;
  const testBuffer = Buffer.from('fake-image-data');

  beforeEach(() => {
    // Ensure clean test directory
    if (!fs.existsSync(TEST_UPLOAD_DIR)) {
      fs.mkdirSync(TEST_UPLOAD_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up all test files
    if (fs.existsSync(TEST_UPLOAD_DIR)) {
      const files = fs.readdirSync(TEST_UPLOAD_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(TEST_UPLOAD_DIR, file));
      }
    }
  });

  afterAll(() => {
    // Clean up test directory (only if empty)
    try {
      fs.rmdirSync(TEST_UPLOAD_DIR);
    } catch {
      // ignore - directory may have files if tests failed
    }
  });

  describe('save()', () => {
    it('should save a file to disk and return a key', async () => {
      const key = await provider.save(testKey, testBuffer);

      expect(key).toBe(testKey);
      expect(fs.existsSync(path.join(TEST_UPLOAD_DIR, testKey))).toBe(true);

      const saved = fs.readFileSync(path.join(TEST_UPLOAD_DIR, testKey));
      expect(saved.toString()).toBe('fake-image-data');
    });

    it('should create the upload directory if it does not exist', async () => {
      // Delete directory first
      fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });

      const key = await provider.save(testKey, testBuffer);

      expect(key).toBe(testKey);
      expect(fs.existsSync(path.join(TEST_UPLOAD_DIR, testKey))).toBe(true);
    });

    it('should preserve the original buffer content', async () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG magic bytes
      await provider.save(testKey, buffer);

      const saved = fs.readFileSync(path.join(TEST_UPLOAD_DIR, testKey));
      expect(Buffer.from(saved).equals(buffer)).toBe(true);
    });
  });

  describe('getUrl()', () => {
    it('should return a URL path for the given key', async () => {
      const url = provider.getUrl(testKey);
      expect(url).toBe(`/uploads/ref/${testKey}`);
    });

    it('should handle subdirectory keys', async () => {
      const url = provider.getUrl('subdir/file.png');
      expect(url).toBe('/uploads/ref/subdir/file.png');
    });
  });

  describe('delete()', () => {
    it('should delete a file from disk', async () => {
      await provider.save(testKey, testBuffer);
      expect(fs.existsSync(path.join(TEST_UPLOAD_DIR, testKey))).toBe(true);

      await provider.delete(testKey);

      expect(fs.existsSync(path.join(TEST_UPLOAD_DIR, testKey))).toBe(false);
    });

    it('should not throw when deleting a non-existent file', async () => {
      await expect(provider.delete('non-existent.png')).resolves.not.toThrow();
    });
  });

  describe('getSignedUrl()', () => {
    it('should return a signed URL string', () => {
      const signedUrl = provider.getSignedUrl(testKey);
      expect(typeof signedUrl).toBe('string');
      expect(signedUrl).toContain('/uploads/ref/');
    });
  });
});

// --- Upload route tests ---

describe('POST /api/upload', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set env for tests
    process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;

    // Ensure clean test directory
    if (!fs.existsSync(TEST_UPLOAD_DIR)) {
      fs.mkdirSync(TEST_UPLOAD_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up all test files
    if (fs.existsSync(TEST_UPLOAD_DIR)) {
      const files = fs.readdirSync(TEST_UPLOAD_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(TEST_UPLOAD_DIR, file));
      }
    }
  });

  function createApp(accountOverride?: Record<string, unknown>) {
    const _app = express();
    _app.use(express.json());
    _app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as any).session = {
        accountId: accountOverride?.id ?? null,
        destroy: vi.fn((cb?: (err?: unknown) => void) => {
          if (cb) cb();
        }),
      };
      next();
    });

    _app.use('/api/upload', uploadRouter);

    return _app;
  }

  function seedRequireSessionQueries(accountRow: Record<string, unknown>) {
    mockQuery.mockResolvedValueOnce({ rows: [accountRow] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [makeWorkspaceRow()] } as any);
  }

  it('401 when not authenticated', async () => {
    app = createApp(); // no session
    const res = await request(app)
      .post('/api/upload')
      .attach('image', Buffer.from('fake-png'), 'test.png');
    expect(res.status).toBe(401);
  });

  it('422 when no file uploaded', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    app = createApp(artist);

    const res = await request(app)
      .post('/api/upload')
      .field('asset_id', 'test-asset')
      .field('version', '1');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message.toLowerCase()).toContain('image');
  });

  it('422 when file type is not allowed (.gif rejected)', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    app = createApp(artist);

    const res = await request(app)
      .post('/api/upload')
      .attach('image', Buffer.from('fake-gif-data'), 'test.gif');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 when file is too large (11MB)', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    app = createApp(artist);

    // Create an 11MB buffer
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024 + 1);

    const res = await request(app).post('/api/upload').attach('image', largeBuffer, 'test.png');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('200 with valid PNG upload returns URL', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    app = createApp(artist);

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG magic bytes

    const res = await request(app).post('/api/upload').attach('image', pngBuffer, 'portrait.png');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
    expect(res.body.url).toMatch(/^\/uploads\/ref\//);
    expect(res.body).toHaveProperty('key');
  });

  it('200 with valid JPG upload returns URL', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    app = createApp(artist);

    const jpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic bytes

    const res = await request(app).post('/api/upload').attach('image', jpgBuffer, 'photo.jpg');

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^\/uploads\/ref\//);
  });

  it('200 with valid WEBP upload returns URL', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    app = createApp(artist);

    const webpBuffer = Buffer.from('RIFF....WEBP');

    const res = await request(app).post('/api/upload').attach('image', webpBuffer, 'image.webp');

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^\/uploads\/ref\//);
  });

  it('file exists on disk after upload at expected path pattern', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    // Mock asset lookup for asset_id validation
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'asset-123' }] } as any);
    app = createApp(artist);

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const res = await request(app)
      .post('/api/upload')
      .field('asset_id', 'asset-123')
      .field('version', '2')
      .attach('image', pngBuffer, 'portrait.png');

    expect(res.status).toBe(200);
    const key = res.body.key as string;
    expect(fs.existsSync(path.join(TEST_UPLOAD_DIR, key))).toBe(true);

    // Check filename pattern
    expect(key).toMatch(/^ref_asset-123_2_[a-z0-9]+\.png$/);
  });

  it('file exists on disk and content matches uploaded data', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    app = createApp(artist);

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const res = await request(app).post('/api/upload').attach('image', pngBuffer, 'portrait.png');

    expect(res.status).toBe(200);
    const key = res.body.key as string;
    const saved = fs.readFileSync(path.join(TEST_UPLOAD_DIR, key));
    expect(Buffer.from(saved).equals(pngBuffer)).toBe(true);
  });

  it('filename uses short uuid when asset_id not provided', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    app = createApp(artist);

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const res = await request(app).post('/api/upload').attach('image', pngBuffer, 'photo.png');

    expect(res.status).toBe(200);
    const key = res.body.key as string;
    // Pattern: ref_<short-uuid>.png (no asset_id/version when not provided)
    expect(key).toMatch(/^ref_[a-z0-9]+\.png$/);
  });

  it('response includes both url and key', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    app = createApp(artist);

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const res = await request(app).post('/api/upload').attach('image', pngBuffer, 'photo.png');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('url');
    expect(res.body).toHaveProperty('key');

    // URL should end with the key
    expect(res.body.url).toContain(res.body.key);
  });

  it('404 when asset_id is provided but does not exist in DB', async () => {
    const artist = makeAccountRow();
    seedRequireSessionQueries(artist);
    // Mock asset lookup returning empty (asset not found)
    mockQuery.mockResolvedValueOnce({ rows: [] } as any);
    app = createApp(artist);

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const res = await request(app)
      .post('/api/upload')
      .field('asset_id', 'nonexistent-asset-id')
      .attach('image', pngBuffer, 'portrait.png');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('nonexistent-asset-id');
  });
});
