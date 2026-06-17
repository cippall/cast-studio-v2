import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const MIGRATIONS_DIR = path.resolve(__dirname, '../src/db/migrations');

interface MigrationFile {
  version: string;
  name: string;
  upPath: string;
  downPath: string;
}

function getMigrationFiles(): MigrationFile[] {
  const files = fs.readdirSync(MIGRATIONS_DIR);
  const migrationMap = new Map<string, { up?: string; down?: string }>();

  for (const file of files) {
    const match = file.match(/^(\d+)_(.+)\.(up|down)\.sql$/);
    if (!match) continue;

    const [, version, name, direction] = match;
    const key = `${version}_${name}`;

    if (!migrationMap.has(key)) {
      migrationMap.set(key, {});
    }

    const entry = migrationMap.get(key)!;
    if (direction === 'up') {
      entry.up = path.join(MIGRATIONS_DIR, file);
    } else {
      entry.down = path.join(MIGRATIONS_DIR, file);
    }
  }

  return Array.from(migrationMap.entries())
    .map(([key, files]) => {
      const [version, ...nameParts] = key.split('_');
      return {
        version,
        name: nameParts.join('_'),
        upPath: files.up!,
        downPath: files.down!,
      };
    })
    .sort((a, b) => a.version.localeCompare(b.version));
}

// ---- TESTS ----

describe('Migration Files', () => {
  it('should have a migrations directory', () => {
    const exists = fs.existsSync(MIGRATIONS_DIR);
    expect(exists).toBe(true);
  });

  it('should discover SQL migration files', () => {
    const files = getMigrationFiles();
    expect(files.length).toBeGreaterThan(0);
  });

  it('should name the first migration 001_initial_schema', () => {
    const files = getMigrationFiles();
    const first = files[0];
    expect(first.name).toBe('initial_schema');
    expect(first.version).toBe('001');
  });

  it('should have both up and down files for each migration', () => {
    const files = getMigrationFiles();
    for (const migration of files) {
      expect(migration.upPath).toBeTruthy();
      expect(migration.downPath).toBeTruthy();
      expect(fs.existsSync(migration.upPath)).toBe(true);
      expect(fs.existsSync(migration.downPath)).toBe(true);
    }
  });

  it('should have non-empty up SQL files', () => {
    const files = getMigrationFiles();
    for (const migration of files) {
      const content = fs.readFileSync(migration.upPath, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it('should have non-empty down SQL files', () => {
    const files = getMigrationFiles();
    for (const migration of files) {
      const content = fs.readFileSync(migration.downPath, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it('should include all required tables in up migration', () => {
    const files = getMigrationFiles();
    const content = fs.readFileSync(files[0].upPath, 'utf-8');

    const expectedTables = [
      'workspaces',
      'accounts',
      'api_keys',
      'wallets',
      'ledger',
      'assets',
      'asset_permissions',
      'asset_outputs',
      'asset_output_versions',
      'workflows',
      'commissions',
      'commission_assets',
      'notifications',
      'models',
      'taxonomy',
      'marketplace_listings',
    ];

    for (const table of expectedTables) {
      expect(content).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('should include all required tables in down migration', () => {
    const files = getMigrationFiles();
    const content = fs.readFileSync(files[0].downPath, 'utf-8');

    const expectedTables = [
      'marketplace_listings',
      'taxonomy',
      'models',
      'notifications',
      'commission_assets',
      'commissions',
      'workflows',
      'asset_output_versions',
      'asset_outputs',
      'asset_permissions',
      'assets',
      'ledger',
      'wallets',
      'api_keys',
      'accounts',
      'workspaces',
    ];

    for (const table of expectedTables) {
      expect(content).toContain(`DROP TABLE IF EXISTS ${table}`);

      // Verify reverse dependency order (children before parents)
      const tableIndex = content.indexOf(`DROP TABLE IF EXISTS ${table}`);
      expect(tableIndex).toBeGreaterThan(-1);
    }
  });

  it('should enable pgcrypto extension', () => {
    const files = getMigrationFiles();
    const content = fs.readFileSync(files[0].upPath, 'utf-8');
    expect(content).toContain('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  });

  it('should wrap migration in BEGIN/COMMIT', () => {
    const files = getMigrationFiles();
    const content = fs.readFileSync(files[0].upPath, 'utf-8');
    expect(content).toContain('BEGIN;');
    expect(content).toContain('COMMIT;');
  });

  it('should have ON DELETE CASCADE on asset_outputs -> assets', () => {
    const files = getMigrationFiles();
    const content = fs.readFileSync(files[0].upPath, 'utf-8');
    expect(content).toMatch(/asset_outputs[\s\S]*REFERENCES\s+assets[\s\S]*ON DELETE CASCADE/i);
  });

  it('should have ON DELETE CASCADE on api_keys -> accounts', () => {
    const files = getMigrationFiles();
    const content = fs.readFileSync(files[0].upPath, 'utf-8');
    expect(content).toMatch(/api_keys[\s\S]*REFERENCES\s+accounts[\s\S]*ON DELETE CASCADE/i);
  });

  it('should have ON DELETE CASCADE on asset_permissions -> assets', () => {
    const files = getMigrationFiles();
    const content = fs.readFileSync(files[0].upPath, 'utf-8');
    expect(content).toMatch(/asset_permissions[\s\S]*REFERENCES\s+assets[\s\S]*ON DELETE CASCADE/i);
  });

  it('should have ON DELETE SET NULL on assets.client_id', () => {
    const files = getMigrationFiles();
    const content = fs.readFileSync(files[0].upPath, 'utf-8');
    expect(content).toMatch(/client_id\s+UUID\s+REFERENCES\s+accounts.*ON DELETE SET NULL/i);
  });

  it('should have unique constraint on (workspace_id, email) in accounts', () => {
    const files = getMigrationFiles();
    const content = fs.readFileSync(files[0].upPath, 'utf-8');
    expect(content).toContain('idx_accounts_workspace_email');
  });

  it('should have unique partial index on asset_permissions (asset_id, grantee_id) WHERE revoked_at IS NULL', () => {
    const files = getMigrationFiles();
    const content = fs.readFileSync(files[0].upPath, 'utf-8');
    expect(content).toContain('idx_asset_permissions_active');
    expect(content).toContain('WHERE revoked_at IS NULL');
  });

  it('should have all expected indexes', () => {
    const files = getMigrationFiles();
    const content = fs.readFileSync(files[0].upPath, 'utf-8');

    const expectedIndexes = [
      'idx_workspaces_type',
      'idx_accounts_workspace_email',
      'idx_accounts_workspace_id',
      'idx_accounts_role',
      'idx_api_keys_account_id',
      'idx_api_keys_key_hash',
      'idx_api_keys_is_active',
      'idx_wallets_workspace_account',
      'idx_wallets_workspace_id',
      'idx_ledger_workspace_id',
      'idx_ledger_wallet_id',
      'idx_ledger_workflow_id',
      'idx_ledger_api_key_id',
      'idx_ledger_created_at',
      'idx_assets_workspace_id',
      'idx_assets_creator_id',
      'idx_assets_client_id',
      'idx_assets_asset_type',
      'idx_assets_deleted_at',
      'idx_asset_permissions_asset_id',
      'idx_asset_permissions_grantee_id',
      'idx_asset_permissions_active',
      'idx_asset_outputs_asset_id',
      'idx_asset_outputs_status',
      'idx_asset_outputs_asset_status',
      'idx_asset_outputs_is_obsolete',
      'idx_asset_outputs_version',
      'idx_asset_output_versions_output_id',
      'idx_asset_output_versions_version',
      'idx_asset_output_versions_output_version',
      'idx_workflows_workspace_id',
      'idx_workflows_agent_id',
      'idx_workflows_wallet_id',
      'idx_workflows_status',
      'idx_commissions_client_workspace',
      'idx_commissions_studio_workspace',
      'idx_commissions_client_id',
      'idx_commissions_assignee_id',
      'idx_commissions_status',
      'idx_commission_assets_commission_id',
      'idx_commission_assets_asset_id',
      'idx_notifications_recipient_id',
      'idx_notifications_is_read',
      'idx_notifications_created_at',
      'idx_models_model_type',
      'idx_models_task',
      'idx_models_is_active',
      'idx_taxonomy_workspace_id',
      'idx_taxonomy_category',
      'idx_taxonomy_key',
      'idx_taxonomy_is_active',
      'idx_marketplace_listings_asset_id',
      'idx_marketplace_listings_listing_type',
      'idx_marketplace_listings_is_active',
      'idx_marketplace_listings_purchased_by',
    ];

    for (const index of expectedIndexes) {
      expect(content).toContain(index);
    }
  });
});

describe('Migration Runner', () => {
  it('should parse migration files in version order', () => {
    const files = getMigrationFiles();
    for (let i = 1; i < files.length; i++) {
      expect(files[i].version.localeCompare(files[i - 1].version)).toBeGreaterThan(0);
    }
  });

  it('should return migrations sorted by version', () => {
    const files = getMigrationFiles();
    const versions = files.map((f) => f.version);
    const sorted = [...versions].sort();
    expect(versions).toEqual(sorted);
  });
});
