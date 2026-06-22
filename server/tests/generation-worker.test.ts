import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pool before importing modules
vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
  getClient: vi.fn(),
  default: {},
}));

const mockPollJob = vi.hoisted(() => vi.fn());
const mockGetWorkspaceApiKey = vi.hoisted(() => vi.fn());
vi.mock('../src/services/fal-service.js', () => ({
  pollJob: mockPollJob,
  getWorkspaceApiKey: mockGetWorkspaceApiKey,
  submitTextToImage: vi.fn(),
  submitImageToImage: vi.fn(),
  cancelJob: vi.fn(),
  imageToText: vi.fn(),
  fetchFalModels: vi.fn(),
}));

// Mock asset-repo
const mockUpdateOutputsStatus = vi.hoisted(() => vi.fn());
vi.mock('../src/db/repositories/asset-repo.js', () => ({
  findPendingOutputs: vi.fn(),
  updateOutputsStatus: mockUpdateOutputsStatus,
}));

// Mock notification-service
vi.mock('../src/services/notification-service.js', () => ({
  notifyWorkflowCompleted: vi.fn(),
  notifyWorkflowFailed: vi.fn(),
}));

import * as poolModule from '../src/db/pool.js';
import { processNow } from '../src/workers/generation-worker.js';

const mockQuery = vi.mocked(poolModule.query);

const WORKSPACE_UUID = 'a0000000-0000-4000-8000-000000000001';
const ASSET_UUID = 'c0000000-0000-4000-8000-000000000001';
const OUTPUT_UUID = 'd0000000-0000-4000-8000-000000000001';
const CREATOR_UUID = 'e0000000-0000-4000-8000-000000000001';

describe('generation-worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processSingleOutput with workspace API key', () => {
    it('looks up workspace_id and passes workspace key to pollJob', async () => {
      const workspaceKey = 'fal-ai_workspace_key_abc123';

      // findPendingOutputs returns one pending output with a fal_job_id
      const { findPendingOutputs } = await import('../src/db/repositories/asset-repo.js');
      vi.mocked(findPendingOutputs).mockResolvedValueOnce([
        {
          id: OUTPUT_UUID,
          asset_id: ASSET_UUID,
          model: 'flux-pro',
          layout_type: 'portrait',
          generation_params: { fal_job_id: 'job-123', seed: 42 },
        },
      ] as any);

      // query for workspace_id from asset
      mockQuery.mockResolvedValueOnce({
        rows: [{ workspace_id: WORKSPACE_UUID }],
      } as any);

      // getWorkspaceApiKey returns the workspace key
      mockGetWorkspaceApiKey.mockResolvedValueOnce(workspaceKey);

      // pollJob returns SUCCESS
      mockPollJob.mockResolvedValueOnce({
        id: 'job-123',
        status: 'SUCCESS',
        image_url: 'https://fal.ai/image.png',
        error_message: null,
        cost_credits: 0.05,
      });

      // query for creator_id (notifyAssetCreator)
      mockQuery.mockResolvedValueOnce({
        rows: [{ creator_id: CREATOR_UUID }],
      } as any);

      await processNow();

      // Verify workspace key lookup was called
      expect(mockGetWorkspaceApiKey).toHaveBeenCalledWith(WORKSPACE_UUID);

      // Verify pollJob was called with the workspace key (3rd arg), not undefined
      expect(mockPollJob).toHaveBeenCalledWith('job-123', 'flux-pro', workspaceKey, 42);
    });

    it('passes undefined to pollJob when no workspace key exists (backward compat)', async () => {
      const { findPendingOutputs } = await import('../src/db/repositories/asset-repo.js');
      vi.mocked(findPendingOutputs).mockResolvedValueOnce([
        {
          id: OUTPUT_UUID,
          asset_id: ASSET_UUID,
          model: 'flux-pro',
          layout_type: 'portrait',
          generation_params: { fal_job_id: 'job-456', seed: 99 },
        },
      ] as any);

      // query for workspace_id from asset
      mockQuery.mockResolvedValueOnce({
        rows: [{ workspace_id: WORKSPACE_UUID }],
      } as any);

      // getWorkspaceApiKey returns undefined (no key configured)
      mockGetWorkspaceApiKey.mockResolvedValueOnce(undefined);

      // pollJob returns SUCCESS
      mockPollJob.mockResolvedValueOnce({
        id: 'job-456',
        status: 'SUCCESS',
        image_url: 'https://fal.ai/image2.png',
        error_message: null,
        cost_credits: 0.05,
      });

      // query for creator_id (notifyAssetCreator)
      mockQuery.mockResolvedValueOnce({
        rows: [{ creator_id: CREATOR_UUID }],
      } as any);

      await processNow();

      // Verify pollJob was called with undefined (falls back to FAL_KEY env)
      expect(mockPollJob).toHaveBeenCalledWith('job-456', 'flux-pro', undefined, 99);
    });

    it('passes undefined to pollJob when asset has no workspace_id', async () => {
      const { findPendingOutputs } = await import('../src/db/repositories/asset-repo.js');
      vi.mocked(findPendingOutputs).mockResolvedValueOnce([
        {
          id: OUTPUT_UUID,
          asset_id: ASSET_UUID,
          model: 'flux-pro',
          layout_type: 'portrait',
          generation_params: { fal_job_id: 'job-789' },
        },
      ] as any);

      // query returns no rows (asset not found)
      mockQuery.mockResolvedValueOnce({
        rows: [],
      } as any);

      // pollJob returns SUCCESS
      mockPollJob.mockResolvedValueOnce({
        id: 'job-789',
        status: 'SUCCESS',
        image_url: 'https://fal.ai/image3.png',
        error_message: null,
        cost_credits: 0.05,
      });

      // query for creator_id (notifyAssetCreator)
      mockQuery.mockResolvedValueOnce({
        rows: [{ creator_id: CREATOR_UUID }],
      } as any);

      await processNow();

      // getWorkspaceApiKey should NOT be called when no workspace_id
      expect(mockGetWorkspaceApiKey).not.toHaveBeenCalled();

      // pollJob called with undefined apiKey
      expect(mockPollJob).toHaveBeenCalledWith('job-789', 'flux-pro', undefined, undefined);
    });
  });

  describe('processSingleOutput with openrouter_result', () => {
    it('skips polling and marks SUCCESS when openrouter_result has content', async () => {
      const { findPendingOutputs } = await import('../src/db/repositories/asset-repo.js');
      vi.mocked(findPendingOutputs).mockResolvedValueOnce([
        {
          id: OUTPUT_UUID,
          asset_id: ASSET_UUID,
          model: 'openrouter/anthropic/claude-3.5-sonnet',
          layout_type: 'headshot',
          generation_params: {
            openrouter_result: {
              content: 'Generated text from OpenRouter',
              finish_reason: 'stop',
            },
            seed: 42,
          },
        },
      ] as any);

      // query for creator_id (notifyAssetCreator)
      mockQuery.mockResolvedValueOnce({
        rows: [{ creator_id: CREATOR_UUID }],
      } as any);

      await processNow();

      // pollJob should NOT be called — result is already in generation_params
      expect(mockPollJob).not.toHaveBeenCalled();

      // updateOutputsStatus should be called with SUCCESS and openrouter_content
      expect(mockUpdateOutputsStatus).toHaveBeenCalledWith(
        ASSET_UUID,
        [OUTPUT_UUID],
        'SUCCESS',
        expect.objectContaining({
          image_url: null,
          openrouter_content: 'Generated text from OpenRouter',
        }),
      );
    });

    it('skips polling and marks FAILED when openrouter_result has error finish_reason', async () => {
      const { findPendingOutputs } = await import('../src/db/repositories/asset-repo.js');
      vi.mocked(findPendingOutputs).mockResolvedValueOnce([
        {
          id: OUTPUT_UUID,
          asset_id: ASSET_UUID,
          model: 'openrouter/anthropic/claude-3.5-sonnet',
          layout_type: 'headshot',
          generation_params: {
            openrouter_result: {
              content: '',
              finish_reason: 'error',
            },
            seed: 42,
          },
        },
      ] as any);

      await processNow();

      // pollJob should NOT be called
      expect(mockPollJob).not.toHaveBeenCalled();

      // updateOutputsStatus should be called with FAILED
      expect(mockUpdateOutputsStatus).toHaveBeenCalledWith(
        ASSET_UUID,
        [OUTPUT_UUID],
        'FAILED',
        expect.objectContaining({
          error_message: 'OpenRouter generation failed (no API key or API error)',
          image_url: null,
        }),
      );
    });

    it('falls through to fal polling when no openrouter_result and fal_job_id present', async () => {
      const { findPendingOutputs } = await import('../src/db/repositories/asset-repo.js');
      vi.mocked(findPendingOutputs).mockResolvedValueOnce([
        {
          id: OUTPUT_UUID,
          asset_id: ASSET_UUID,
          model: 'flux-pro',
          layout_type: 'portrait',
          generation_params: {
            fal_job_id: 'job-fal-123',
            seed: 99,
          },
        },
      ] as any);

      // query for workspace_id from asset
      mockQuery.mockResolvedValueOnce({
        rows: [{ workspace_id: WORKSPACE_UUID }],
      } as any);

      // getWorkspaceApiKey returns undefined
      mockGetWorkspaceApiKey.mockResolvedValueOnce(undefined);

      // pollJob returns SUCCESS
      mockPollJob.mockResolvedValueOnce({
        id: 'job-fal-123',
        status: 'SUCCESS',
        image_url: 'https://fal.ai/image.png',
        error_message: null,
        cost_credits: 0.05,
      });

      // query for creator_id (notifyAssetCreator)
      mockQuery.mockResolvedValueOnce({
        rows: [{ creator_id: CREATOR_UUID }],
      } as any);

      await processNow();

      // pollJob SHOULD be called for fal.ai job
      expect(mockPollJob).toHaveBeenCalledWith('job-fal-123', 'flux-pro', undefined, 99);

      // updateOutputsStatus should be called with SUCCESS and image_url
      expect(mockUpdateOutputsStatus).toHaveBeenCalledWith(
        ASSET_UUID,
        [OUTPUT_UUID],
        'SUCCESS',
        expect.objectContaining({
          image_url: 'https://fal.ai/image.png',
        }),
      );
    });
  });
});
