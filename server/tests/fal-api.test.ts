import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock pool before importing modules that use it
vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  submitTextToImage,
  submitImageToImage,
  pollJob,
  cancelJob,
} from '../src/services/fal/api.js';

const FAL_API_BASE = 'https://queue.fal.run/fal-ai';

describe('fal-api dynamic model endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no FAL_KEY env
    delete process.env.FAL_KEY;
  });

  describe('getModelEndpoint via submitTextToImage', () => {
    it('uses hardcoded endpoint for flux-pro', async () => {
      process.env.FAL_KEY = 'test-key';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: 'test-123' }),
      });

      await submitTextToImage({
        model: 'flux-pro',
        prompt: 'test',
        seed: 42,
      });

      expect(mockFetch).toHaveBeenCalledWith(`${FAL_API_BASE}/flux-pro`, expect.any(Object));
    });

    it('uses hardcoded endpoint for flux-realism', async () => {
      process.env.FAL_KEY = 'test-key';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: 'test-456' }),
      });

      await submitTextToImage({
        model: 'flux-realism',
        prompt: 'test',
        seed: 42,
      });

      expect(mockFetch).toHaveBeenCalledWith(`${FAL_API_BASE}/flux-realism`, expect.any(Object));
    });

    it('uses dynamic endpoint for non-hardcoded model ID', async () => {
      process.env.FAL_KEY = 'test-key';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: 'test-789' }),
      });

      await submitTextToImage({
        model: 'fal-ai/flux/dev',
        prompt: 'test',
        seed: 42,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://queue.fal.run/fal-ai/flux/dev',
        expect.any(Object),
      );
    });

    it('uses dynamic endpoint for custom model path', async () => {
      process.env.FAL_KEY = 'test-key';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: 'test-abc' }),
      });

      await submitTextToImage({
        model: 'fal-ai/sdxl-turbo/v1',
        prompt: 'test',
        seed: 42,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://queue.fal.run/fal-ai/sdxl-turbo/v1',
        expect.any(Object),
      );
    });
  });

  describe('getModelEndpoint via submitImageToImage', () => {
    it('uses dynamic endpoint for non-hardcoded model', async () => {
      process.env.FAL_KEY = 'test-key';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: 'img-123' }),
      });

      await submitImageToImage({
        model: 'fal-ai/flux-canny/v1',
        prompt: 'test',
        seed: 42,
        image_url: 'https://example.com/img.png',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://queue.fal.run/fal-ai/flux-canny/v1',
        expect.any(Object),
      );
    });

    it('uses hardcoded endpoint for sdxl-turbo', async () => {
      process.env.FAL_KEY = 'test-key';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: 'img-456' }),
      });

      await submitImageToImage({
        model: 'sdxl-turbo',
        prompt: 'test',
        seed: 42,
        image_url: 'https://example.com/img.png',
      });

      expect(mockFetch).toHaveBeenCalledWith(`${FAL_API_BASE}/sdxl-turbo`, expect.any(Object));
    });
  });

  describe('getModelEndpoint via pollJob', () => {
    it('uses dynamic endpoint for non-hardcoded model', async () => {
      process.env.FAL_KEY = 'test-key';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'COMPLETED',
          output: { images: [{ url: 'https://example.com/result.png' }] },
        }),
      });

      await pollJob('job-123', 'fal-ai/flux/dev');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://queue.fal.run/fal-ai/flux/dev/requests/job-123',
        expect.any(Object),
      );
    });
  });

  describe('getModelEndpoint via cancelJob', () => {
    it('uses dynamic endpoint for non-hardcoded model', async () => {
      process.env.FAL_KEY = 'test-key';
      mockFetch.mockResolvedValueOnce({ ok: true });

      await cancelJob('job-456', 'fal-ai/custom-model/v2');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://queue.fal.run/fal-ai/custom-model/v2/requests/job-456/cancel',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('simulated mode (no FAL_KEY)', () => {
    it('returns simulated job ID without calling fetch', async () => {
      // No FAL_KEY set
      const result = await submitTextToImage({
        model: 'fal-ai/flux/dev',
        prompt: 'test',
        seed: 42,
      });

      expect(result.jobId).toMatch(/^sim_/);
      expect(result.status).toBe('PENDING');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('pollJob returns a data URI placeholder in simulated mode', async () => {
      // No FAL_KEY set
      const result = await pollJob('sim_1234567890_abcdefg', 'flux-pro');

      expect(result.status).toBe('SUCCESS');
      expect(result.image_url).toMatch(/^data:image\/png;base64,/);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
