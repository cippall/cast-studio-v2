import { describe, it, expect, vi, beforeEach } from 'vitest';

/* eslint-disable @typescript-eslint/no-explicit-any */

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

// ================================================================
// API key resolution (apiKey parameter takes precedence over FAL_KEY env)
// ================================================================
describe('fal.ai API key resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FAL_KEY;
  });

  describe('submitTextToImage with explicit apiKey', () => {
    it('uses provided apiKey instead of FAL_KEY env', async () => {
      process.env.FAL_KEY = 'env-key';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: 'explicit-job-123' }),
      });

      const result = await submitTextToImage(
        { model: 'flux-pro', prompt: 'test', seed: 42 },
        'explicit-key',
      );

      expect(result.jobId).toBe('explicit-job-123');
      expect(mockFetch).toHaveBeenCalledWith(
        `${FAL_API_BASE}/flux-pro`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Key explicit-key',
          }),
        }),
      );
    });

    it('falls back to FAL_KEY env when no apiKey provided', async () => {
      process.env.FAL_KEY = 'fallback-key';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ request_id: 'fallback-job-123' }),
      });

      const result = await submitTextToImage({ model: 'flux-pro', prompt: 'test', seed: 42 });

      expect(result.jobId).toBe('fallback-job-123');
      expect(mockFetch).toHaveBeenCalledWith(
        `${FAL_API_BASE}/flux-pro`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Key fallback-key',
          }),
        }),
      );
    });

    it('returns sim job when no apiKey and no FAL_KEY', async () => {
      const result = await submitTextToImage({
        model: 'flux-pro',
        prompt: 'test',
        seed: 42,
      });

      expect(result.jobId).toMatch(/^sim_/);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('pollJob with explicit apiKey', () => {
    it('uses provided apiKey for polling', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'COMPLETED',
          output: { images: [{ url: 'https://example.com/img.png' }] },
        }),
      });

      await pollJob('job-123', 'flux-pro', 'poll-key');

      expect(mockFetch).toHaveBeenCalledWith(
        `${FAL_API_BASE}/flux-pro/requests/job-123`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Key poll-key',
          }),
        }),
      );
    });
  });
});

// ================================================================
// form_data and reference_images passing
// ================================================================
describe('form_data and reference_images in submitTextToImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FAL_KEY;
  });

  it('includes form_data in fal.ai body when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ request_id: 'form-job-123' }),
    });

    await submitTextToImage(
      {
        model: 'flux-pro',
        prompt: 'test prompt',
        seed: 42,
        form_data: { gender: 'female', age: '25-35', ethnicity: 'asian' },
      },
      'test-key',
    );

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      prompt: 'test prompt',
      form_data: { gender: 'female', age: '25-35', ethnicity: 'asian' },
    });
  });

  it('does not include form_data key when not provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ request_id: 'no-form-job-123' }),
    });

    await submitTextToImage({ model: 'flux-pro', prompt: 'test', seed: 42 }, 'test-key');

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody).not.toHaveProperty('form_data');
  });

  it('includes reference_images in fal.ai body when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ request_id: 'ref-job-123' }),
    });

    await submitTextToImage(
      {
        model: 'flux-pro',
        prompt: 'test with reference',
        seed: 42,
        reference_images: ['https://example.com/ref1.png', 'https://example.com/ref2.png'],
      },
      'test-key',
    );

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      prompt: 'test with reference',
      reference_images: ['https://example.com/ref1.png', 'https://example.com/ref2.png'],
    });
  });
});

// ================================================================
// submitImageToImage with apiKey (REFERENCE mode)
// ================================================================
describe('submitImageToImage with apiKey (REFERENCE mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FAL_KEY;
  });

  it('uses provided apiKey for image-to-image submission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ request_id: 'img2img-job-123' }),
    });

    await submitImageToImage(
      {
        model: 'flux-canny',
        prompt: 'transform this',
        seed: 42,
        image_url: 'https://example.com/input.png',
        strength: 0.8,
      },
      'img2img-key',
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'https://queue.fal.run/fal-ai/flux-canny',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Key img2img-key',
        }),
      }),
    );

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      image_url: 'https://example.com/input.png',
      prompt: 'transform this',
      strength: 0.8,
    });
  });

  it('falls back to FAL_KEY for image-to-image when no apiKey', async () => {
    process.env.FAL_KEY = 'env-fallback';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ request_id: 'img2img-fallback-123' }),
    });

    await submitImageToImage({
      model: 'flux-canny',
      prompt: 'transform',
      seed: 1,
      image_url: 'https://example.com/in.png',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Key env-fallback',
        }),
      }),
    );
  });
});
