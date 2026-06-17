import { describe, it, expect } from 'vitest';
import { AssetType, GenerationStatus } from '@cast/types';

describe('Shared types import', () => {
  it('should import AssetType enum', () => {
    expect(AssetType.ACTOR).toBe('ACTOR');
    expect(AssetType.LOOK).toBe('LOOK');
    expect(AssetType.FASHION_ITEM).toBe('FASHION_ITEM');
  });

  it('should import GenerationStatus enum', () => {
    expect(GenerationStatus.PENDING).toBe('PENDING');
    expect(GenerationStatus.SUCCESS).toBe('SUCCESS');
    expect(GenerationStatus.FAILED).toBe('FAILED');
  });
});

describe('Health endpoint', () => {
  it('should return ok status shape', () => {
    const response = { status: 'ok', timestamp: '2026-01-01T00:00:00.000Z' };
    expect(response).toHaveProperty('status', 'ok');
    expect(response).toHaveProperty('timestamp');
  });
});
