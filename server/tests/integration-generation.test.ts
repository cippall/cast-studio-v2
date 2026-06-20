/**
 * Integration: Actor Generation + Versioning
 *
 * Tests generate → regenerate → version history using mocked DB.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  mockQuery,
  resetMock,
  ACTOR,
  ARTIST,
  OUTPUT_V1,
  OUTPUT_V2,
  actorRow,
  walletRow,
  outputRow,
  artistAccount,
} from './integration-fixtures';

import * as generationService from '../src/services/generation-service.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Integration: Actor Generation + Versioning', () => {
  beforeEach(() => {
    resetMock();
  });

  it('generates headshot, regenerates creating version 2', async () => {
    // Generate: findAssetById + findPromptByTask + findWallet + updateWalletBalance + createLedgerEntry + createAssetOutput + UPDATE fal_job_id
    mockQuery.mockResolvedValueOnce({ rows: [actorRow()] } as any);
    // listActiveModels is mocked at module level (returns [])
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // findPromptByTask (no system prompt configured)
    mockQuery.mockResolvedValueOnce({ rows: [walletRow()] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [walletRow({ balance_credits: 49.95 })] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ledger-1' }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [outputRow({ id: OUTPUT_V1 })] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // UPDATE asset_outputs SET generation_params (fal job ID)

    const genResult = await generationService.generateActorOutput(ACTOR, artistAccount(), {
      layout_type: 'headshot',
    });
    expect(genResult.outputs.length).toBe(1);
    expect(genResult.outputs[0].status).toBe('PENDING');

    // Regenerate: findAssetById + findPromptByTask + findWallet + updateWalletBalance + createLedgerEntry + getAssetOutputs + archiveAssetOutput(SELECT+INSERT) + markDownstreamObsolete + createAssetOutput + UPDATE fal_job_id
    resetMock();
    mockQuery.mockResolvedValueOnce({ rows: [actorRow()] } as any);
    // listActiveModels is mocked at module level (returns [])
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // findPromptByTask (no system prompt configured)
    mockQuery.mockResolvedValueOnce({ rows: [walletRow({ balance_credits: 49.95 })] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [walletRow({ balance_credits: 49.9 })] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ledger-2' }] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [outputRow({ id: OUTPUT_V1, version: 1 })] } as any);
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ver-1' }] } as any); // archiveAssetOutput SELECT
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // archiveAssetOutput INSERT
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // markDownstreamObsolete
    mockQuery.mockResolvedValueOnce({ rows: [outputRow({ id: OUTPUT_V2, version: 2 })] } as any); // createAssetOutput
    mockQuery.mockResolvedValueOnce({ rows: [] } as any); // UPDATE asset_outputs SET generation_params (fal job ID)

    const regenResult = await generationService.regenerateActorOutput(
      ACTOR,
      'headshot',
      artistAccount(),
      { layout_type: 'headshot' },
    );
    expect(regenResult.outputs.length).toBe(1);
    expect(regenResult.outputs[0].status).toBe('PENDING');

    // Verify version history
    resetMock();
    mockQuery.mockResolvedValueOnce({ rows: [outputRow({ id: OUTPUT_V2, version: 2 })] } as any);
    const status = await generationService.getGenerationStatus(OUTPUT_V2);
    expect(status).not.toBeNull();
    expect(status!.version).toBe(2);
  });

  it('prevents generation on marketplace-frozen actor', async () => {
    resetMock();
    mockQuery.mockResolvedValueOnce({
      rows: [actorRow({ marketplace_status: 'MARKETPLACE_APPROVED', is_marketplace_frozen: true })],
    } as any);
    await expect(
      generationService.generateActorOutput(ACTOR, artistAccount(), {
        layout_type: 'headshot',
        model: 'flux-pro',
      }),
    ).rejects.toThrow('marketplace-frozen');
  });
});
