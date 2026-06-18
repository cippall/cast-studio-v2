/**
 * Shared mock pool helpers for tests.
 *
 * Usage in test files:
 *   vi.mock('../src/db/pool.js', () => {
 *     const mockPoolClient = createMockPoolClient();
 *     return {
 *       query: vi.fn(),
 *       getClient: vi.fn().mockResolvedValue(mockPoolClient),
 *       default: { connect: vi.fn().mockResolvedValue(mockPoolClient) },
 *     };
 *   });
 */
export function createMockPoolClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
    on: vi.fn(),
  };
}
