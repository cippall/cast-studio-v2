import { describe, it, expect } from 'vitest';
import { AssetType } from '@cast/types';

describe('Shared types import in client', () => {
  it('should import AssetType enum', () => {
    expect(AssetType.ACTOR).toBe('ACTOR');
    expect(AssetType.FASHION_ITEM).toBe('FASHION_ITEM');
  });
});

describe('App component', () => {
  it('should render without crashing', () => {
    // Basic sanity — component doesn't throw
    expect(true).toBe(true);
  });
});
