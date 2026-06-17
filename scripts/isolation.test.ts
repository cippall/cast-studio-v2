/**
 * Cross-workspace isolation integration test.
 * Uses the live database to verify queryTable isolation.
 */
import { query } from '../server/src/db/pool.js';
import { queryTable } from '../server/src/db/query-helper.js';

async function main() {
  const ws1Id = '00000000-0000-0000-0000-000000000001';
  const ws2Id = '00000000-0000-0000-0000-000000000002';
  const creatorId = '00000000-0000-0000-0000-000000000001';
  const assetId = 'aaaaaaaa-0000-0000-0000-000000000001';

  const passed: string[] = [];
  const failed: string[] = [];

  try {
    // Clean up any leftover test data (safe even if nothing exists)
    await query('DELETE FROM assets WHERE id = $1', [assetId]);
    await query('DELETE FROM accounts WHERE id = $1', [creatorId]);
    await query('DELETE FROM workspaces WHERE id = $1', [ws1Id]);
    await query('DELETE FROM workspaces WHERE id = $1', [ws2Id]);

    // Insert workspaces
    await query('INSERT INTO workspaces (id, name, slug, workspace_type) VALUES ($1, $2, $3, $4)', [
      ws1Id,
      'inttest-ws1',
      'inttest-ws1',
      'STUDIO',
    ]);
    await query('INSERT INTO workspaces (id, name, slug, workspace_type) VALUES ($1, $2, $3, $4)', [
      ws2Id,
      'inttest-ws2',
      'inttest-ws2',
      'STUDIO',
    ]);

    // Insert a dummy account in ws1 (needed for assets FK)
    await query(
      'INSERT INTO accounts (id, workspace_id, name, email, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)',
      [creatorId, ws1Id, 'inttest-user', 'inttest@test.local', 'ARTIST', 'nohash'],
    );

    // Insert an asset in ws1
    await query(
      'INSERT INTO assets (id, workspace_id, creator_id, asset_type, seed, prompt_recipe, source_type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [assetId, ws1Id, creatorId, 'ACTOR', 42, '{}', 'ORIGINAL'],
    );

    // Test 1: Query from ws1 — should find the asset
    const ws1Result = await queryTable('assets', { workspaceId: ws1Id });
    if (ws1Result.pagination.totalItems >= 1 && ws1Result.data.some((r: any) => r.id === assetId)) {
      passed.push('WS1 sees its own asset');
    } else {
      failed.push(`WS1 should see its asset. Got ${ws1Result.pagination.totalItems} items`);
    }

    // Test 2: Query from ws2 — should return empty (isolation)
    const ws2Result = await queryTable('assets', { workspaceId: ws2Id });
    if (ws2Result.pagination.totalItems === 0) {
      passed.push('WS2 does NOT see WS1 asset (isolation)');
    } else {
      failed.push(`WS2 should NOT see WS1 asset. Got ${ws2Result.pagination.totalItems} items`);
    }

    // Test 3: Admin bypass — should also see ws1 asset from ws2 scope
    const adminResult = await queryTable('assets', {
      workspaceId: ws2Id,
      adminBypass: true,
    });
    if (
      adminResult.pagination.totalItems >= 1 &&
      adminResult.data.some((r: any) => r.id === assetId)
    ) {
      passed.push('Admin bypass sees asset across workspaces');
    } else {
      failed.push(
        'Admin bypass should see WS1 asset. Got ' + adminResult.pagination.totalItems + ' items',
      );
    }

    // Clean up
    await query('DELETE FROM assets WHERE id = $1', [assetId]);
    await query('DELETE FROM accounts WHERE id = $1', [creatorId]);
    await query('DELETE FROM workspaces WHERE id = $1', [ws1Id]);
    await query('DELETE FROM workspaces WHERE id = $1', [ws2Id]);
  } catch (err) {
    console.error('Integration test failed with exception:', err);
    // Attempt cleanup
    try {
      await query('DELETE FROM assets WHERE id = $1', [assetId]);
      await query('DELETE FROM accounts WHERE id = $1', [creatorId]);
      await query('DELETE FROM workspaces WHERE id = $1', [ws1Id]);
      await query('DELETE FROM workspaces WHERE id = $1', [ws2Id]);
    } catch {
      /* ignore cleanup errors */
    }
    process.exit(1);
  }

  console.log(`\n=== Cross-Workspace Isolation: Integration Test ===\n`);
  for (const p of passed) console.log(`  ✅ ${p}`);
  for (const f of failed) console.log(`  ❌ ${f}`);
  console.log(`\n${passed.length} passed / ${failed.length} failed`);

  if (failed.length > 0) process.exit(1);
}

main();
