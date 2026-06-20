import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the prompt-repo module
vi.mock('../src/db/repositories/prompt-repo.js', () => ({
  findPromptByTask: vi.fn(),
}));

import { resolvePrompt } from '../src/services/prompt-service.js';
import { findPromptByTask } from '../src/db/repositories/prompt-repo.js';

const mockFindPrompt = vi.mocked(findPromptByTask);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolvePrompt', () => {
  it('replaces single variable in template', async () => {
    mockFindPrompt.mockResolvedValue({
      id: 'p1',
      task: 'actor_headshot',
      template: 'Headshot of {{identity_description}}',
      variables: ['identity_description'],
      updated_at: '2026-06-17T10:00:00Z',
      created_at: '2026-06-17T10:00:00Z',
    });

    const result = await resolvePrompt('actor_headshot', {
      identity_description: 'a young woman',
    });

    expect(result).toBe('Headshot of a young woman');
  });

  it('replaces multiple variables in template', async () => {
    mockFindPrompt.mockResolvedValue({
      id: 'p1',
      task: 'actor_headshot',
      template: 'Headshot of {{identity_description}}, {{age}} old',
      variables: ['identity_description', 'age'],
      updated_at: '2026-06-17T10:00:00Z',
      created_at: '2026-06-17T10:00:00Z',
    });

    const result = await resolvePrompt('actor_headshot', {
      identity_description: 'a model',
      age: '25',
    });

    expect(result).toBe('Headshot of a model, 25 old');
  });

  it('leaves unreplaced placeholders when variable is missing', async () => {
    mockFindPrompt.mockResolvedValue({
      id: 'p1',
      task: 'actor_headshot',
      template: 'Headshot of {{identity_description}} in {{location}}',
      variables: ['identity_description', 'location'],
      updated_at: '2026-06-17T10:00:00Z',
      created_at: '2026-06-17T10:00:00Z',
    });

    const result = await resolvePrompt('actor_headshot', {
      identity_description: 'a model',
    });

    expect(result).toBe('Headshot of a model in {{location}}');
  });

  it('converts non-string values to strings', async () => {
    mockFindPrompt.mockResolvedValue({
      id: 'p1',
      task: 'actor_headshot',
      template: 'Age: {{age}}',
      variables: ['age'],
      updated_at: '2026-06-17T10:00:00Z',
      created_at: '2026-06-17T10:00:00Z',
    });

    const result = await resolvePrompt('actor_headshot', {
      age: 25,
    });

    expect(result).toBe('Age: 25');
  });

  it('uses empty string for null/undefined values', async () => {
    mockFindPrompt.mockResolvedValue({
      id: 'p1',
      task: 'actor_headshot',
      template: 'Headshot of {{identity_description}}',
      variables: ['identity_description'],
      updated_at: '2026-06-17T10:00:00Z',
      created_at: '2026-06-17T10:00:00Z',
    });

    const result = await resolvePrompt('actor_headshot', {
      identity_description: null,
    });

    expect(result).toBe('Headshot of ');
  });

  it('calls findPromptByTask with the correct task', async () => {
    mockFindPrompt.mockResolvedValue({
      id: 'p1',
      task: 'fashion_item',
      template: 'Photo of {{item_description}}',
      variables: ['item_description'],
      updated_at: '2026-06-17T10:00:00Z',
      created_at: '2026-06-17T10:00:00Z',
    });

    await resolvePrompt('fashion_item', { item_description: 'a red dress' });

    expect(mockFindPrompt).toHaveBeenCalledWith('fashion_item');
  });
});

describe('resolvePrompt — fallback when no prompt configured', () => {
  const fallbackTasks = [
    'actor_headshot',
    'actor_fullshot',
    'actor_expressions',
    'actor_editorial',
    'actor_character_sheet',
    'look_generation',
    'fashion_item',
    'reference_extraction',
    'character_sheet_composition',
  ];

  for (const task of fallbackTasks) {
    it(`returns fallback for ${task} when no prompt exists`, async () => {
      mockFindPrompt.mockResolvedValue(null);

      const result = await resolvePrompt(task, {
        identity_description: 'a young actor',
        look_description: 'a blue suit',
        item_description: 'red heels',
      });

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  }

  it('returns generic fallback for unknown task', async () => {
    mockFindPrompt.mockResolvedValue(null);

    const result = await resolvePrompt('unknown_task', {
      identity_description: 'something',
    });

    expect(result).toContain('something');
  });

  it('falls back to JSON when no identity_description is provided', async () => {
    mockFindPrompt.mockResolvedValue(null);

    const result = await resolvePrompt('actor_headshot', {
      some_field: 'some_value',
    });

    // Should not crash — uses JSON.stringify of variables
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});
