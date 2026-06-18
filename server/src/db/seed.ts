/**
 * Seed script for Cast Studio v2 development database.
 *
 * Creates:
 *   - 1 Studio workspace
 *   - 1 Admin account (admin@cast.studio)
 *   - 2 Artist accounts (1 API-enabled) in the Studio workspace
 *   - 1 Client workspace
 *   - 1 Client account (client@brand.com)
 *   - Sample assets (Actor with outputs, Look, Fashion Item)
 *   - Wallet for the Client with 100 credits
 *   - API key for the API-enabled Artist
 *
 * Usage:  npx tsx src/db/seed.ts
 * Requires: DATABASE_URL env var or .env file at project root
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { dbConfig } from './config.js';

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'password123';

interface SeedIds {
  studioWorkspaceId: string;
  clientWorkspaceId: string;
  adminId: string;
  artist1Id: string;
  artist2Id: string;
  clientId: string;
  actorId: string;
  lookId: string;
  fashionItemId: string;
  walletId: string;
  apiKeyId: string;
}

async function seed() {
  const pool = new pg.Pool(dbConfig);
  const ids: SeedIds = {
    studioWorkspaceId: randomUUID(),
    clientWorkspaceId: randomUUID(),
    adminId: randomUUID(),
    artist1Id: randomUUID(),
    artist2Id: randomUUID(),
    clientId: randomUUID(),
    actorId: randomUUID(),
    lookId: randomUUID(),
    fashionItemId: randomUUID(),
    walletId: randomUUID(),
    apiKeyId: randomUUID(),
  };

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // --- Workspaces ---
    await client.query(
      `INSERT INTO workspaces (id, name, slug, workspace_type, created_at)
       VALUES ($1, $2, $3, $4, NOW()),
              ($5, $6, $7, $8, NOW())`,
      [
        ids.studioWorkspaceId,
        'Cast Studio',
        'cast-studio',
        'STUDIO',
        ids.clientWorkspaceId,
        'Brand Client',
        'brand-client',
        'CLIENT',
      ],
    );

    // --- Accounts ---
    await client.query(
      `INSERT INTO accounts (id, workspace_id, name, email, role, is_api_able, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()),
              ($8, $2, $9, $10, $11, $12, $7, NOW()),
              ($13, $2, $14, $15, $16, $17, $7, NOW()),
              ($18, $19, $20, $21, $22, $23, $7, NOW())`,
      [
        // Admin
        ids.adminId,
        ids.studioWorkspaceId,
        'Admin User',
        'admin@cast.studio',
        'ADMIN',
        false,
        passwordHash,
        // Artist 1 (API-enabled)
        ids.artist1Id,
        'API Artist',
        'api-artist@cast.studio',
        'ARTIST',
        true,
        // Artist 2 (regular)
        ids.artist2Id,
        'Regular Artist',
        'artist@cast.studio',
        'ARTIST',
        false,
        // Client
        ids.clientId,
        ids.clientWorkspaceId,
        'Client User',
        'client@cast.studio',
        'CLIENT',
        false,
      ],
    );

    // --- API Key for Artist 1 ---
    const apiKeyRaw = `cs_live_${randomUUID().replace(/-/g, '')}`;
    const apiKeyHash = await bcrypt.hash(apiKeyRaw, SALT_ROUNDS);
    await client.query(
      `INSERT INTO api_keys (id, account_id, key_hash, name, is_active, created_at)
       VALUES ($1, $2, $3, $4, true, NOW())`,
      [ids.apiKeyId, ids.artist1Id, apiKeyHash, 'Dev API Key'],
    );

    // --- Wallet for Client ---
    await client.query(
      `INSERT INTO wallets (id, workspace_id, account_id, balance_credits, updated_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [ids.walletId, ids.clientWorkspaceId, ids.clientId, '100.00'],
    );

    // --- Ledger entry for initial top-up ---
    await client.query(
      `INSERT INTO ledger (id, wallet_id, amount, type, description, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [randomUUID(), ids.walletId, '100.00', 'TOP_UP', 'Initial seed balance'],
    );

    // --- Sample Actor with outputs ---
    await client.query(
      `INSERT INTO assets (id, workspace_id, creator_id, client_id, asset_type, name, seed,
        prompt_recipe, marketplace_status, is_marketplace_frozen, source_asset_id, source_type, deleted_at, created_at)
       VALUES ($1, $2, $3, null, 'ACTOR', 'Cyberpunk Woman', 12345,
        '{"identity":{"age":25,"gender":"female","ethnicity":"east_asian"}}',
        null, false, null, 'ORIGINAL', null, NOW())`,
      [ids.actorId, ids.studioWorkspaceId, ids.artist1Id],
    );

    // Actor outputs: headshot, fullshot, expressions
    const outputLayouts = ['headshot', 'fullshot', 'expressions_3x4'] as const;
    for (const layout of outputLayouts) {
      await client.query(
        `INSERT INTO asset_outputs (id, asset_id, layout_type, model, image_url, local_backup_url,
          cost_credits, status, version, is_obsolete, obsolete_reason, error_message,
          generation_params, reference_images, source_asset_outputs, created_at)
         VALUES ($1, $2, $3, $4, $5, null, $6, $7, 1, false, null, null, $8, null, null, NOW())`,
        [
          randomUUID(),
          ids.actorId,
          layout,
          'flux-pro',
          `https://fal.ai/images/${layout}.png`,
          '0.05',
          'SUCCESS',
          JSON.stringify({ seed: 12345, resolution: '1024x1024', steps: 30 }),
        ],
      );
    }

    // --- Sample Look ---
    await client.query(
      `INSERT INTO assets (id, workspace_id, creator_id, client_id, asset_type, name, seed,
        prompt_recipe, marketplace_status, is_marketplace_frozen, source_asset_id, source_type, deleted_at, created_at)
       VALUES ($1, $2, $3, null, 'LOOK', 'Neon Streetwear', 54321,
        '{"style":"streetwear","items":["jacket","pants","sneakers"]}',
        null, false, null, 'ORIGINAL', null, NOW())`,
      [ids.lookId, ids.studioWorkspaceId, ids.artist1Id],
    );

    await client.query(
      `INSERT INTO asset_outputs (id, asset_id, layout_type, model, image_url, local_backup_url,
        cost_credits, status, version, is_obsolete, obsolete_reason, error_message,
        generation_params, reference_images, source_asset_outputs, created_at)
       VALUES ($1, $2, $3, $4, $5, null, $6, $7, 1, false, null, null, $8, null, null, NOW())`,
      [
        randomUUID(),
        ids.lookId,
        'look',
        'flux-pro',
        'https://fal.ai/images/look.png',
        '0.05',
        'SUCCESS',
        JSON.stringify({ seed: 54321, resolution: '1024x1024', steps: 30 }),
      ],
    );

    // --- Sample Fashion Item ---
    await client.query(
      `INSERT INTO assets (id, workspace_id, creator_id, client_id, asset_type, name, seed,
        prompt_recipe, marketplace_status, is_marketplace_frozen, source_asset_id, source_type, deleted_at, created_at)
       VALUES ($1, $2, $3, null, 'FASHION_ITEM', 'Leather Jacket', 99999,
        {"item_type":"jacket","material":"leather","color":"black"},
        null, false, null, 'ORIGINAL', null, NOW())`,
      [ids.fashionItemId, ids.studioWorkspaceId, ids.artist1Id],
    );

    await client.query(
      `INSERT INTO asset_outputs (id, asset_id, layout_type, model, image_url, local_backup_url,
        cost_credits, status, version, is_obsolete, obsolete_reason, error_message,
        generation_params, reference_images, source_asset_outputs, created_at)
       VALUES ($1, $2, $3, $4, $5, null, $6, $7, 1, false, null, null, $8, null, null, NOW())`,
      [
        randomUUID(),
        ids.fashionItemId,
        'fashion_item',
        'flux-pro',
        'https://fal.ai/images/fashion-item.png',
        '0.05',
        'SUCCESS',
        JSON.stringify({ seed: 99999, resolution: '1024x1024', steps: 30 }),
      ],
    );

    await client.query('COMMIT');

    console.log('Seed data created successfully.');
    console.log('');
    console.log('=== Credentials ===');
    console.log(`Admin:    admin@cast.studio / ${DEFAULT_PASSWORD}`);
    console.log(`Artist 1: api-artist@cast.studio / ${DEFAULT_PASSWORD} (API-enabled)`);
    console.log(`Artist 2: artist@cast.studio / ${DEFAULT_PASSWORD}`);
    console.log(`Client:   client@brand.com / ${DEFAULT_PASSWORD}`);
    console.log('');
    console.log('=== API Key (Artist 1) ===');
    console.log(`Key: ${apiKeyRaw}`);
    console.log('');
    console.log('=== IDs ===');
    console.log(`Studio Workspace: ${ids.studioWorkspaceId}`);
    console.log(`Client Workspace: ${ids.clientWorkspaceId}`);
    console.log(`Actor:            ${ids.actorId}`);
    console.log(`Look:             ${ids.lookId}`);
    console.log(`Fashion Item:     ${ids.fashionItemId}`);
    console.log(`Client Wallet:    ${ids.walletId} (100.00 credits)`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
