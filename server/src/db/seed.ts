/**
 * Seed script for Cast Studio v2 development database.
 *
 * Creates a full dataset so no page in the UI is empty:
 *   - 1 Studio workspace, 2 Client workspaces
 *   - 1 Admin, 3 Artists (2 API-enabled), 2 Clients
 *   - 5 Actors with full output sets (headshot, fullshot, expressions, editorial, character_sheet)
 *   - 4 Looks with outputs
 *   - 4 Fashion Items with outputs
 *   - 3 Commissions across different statuses
 *   - Asset permissions, output versions, notifications
 *   - Workflow + escrow data
 *   - Marketplace listings (active + purchased)
 *   - AI Models and Taxonomy entries
 *
 * Usage:  npx tsx src/db/seed.ts
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { dbConfig } from './config.js';

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'password123';

const uid = () => randomUUID();

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function actorName(): string {
  const vibes = ['Cyberpunk','Noir','Glamour','Streetwear','Bohemian','Minimalist','Avant-Garde','Retro','Ethereal','Industrial'];
  const genders = ['Woman','Man','Non-Binary'];
  return `${pick(vibes)} ${pick(genders)} ${Math.floor(Math.random()*900)+100}`;
}

function lookName(): string {
  const items = ['Neon Streetwear','Midnight Gala','Urban Explorer','Desert Nomad','Arctic Tech','Vintage Denim','Power Suit','Festival Wear','Athleisure Luxe','Cyber Casual','Coastal Breeze','Grunge Revival'];
  return pick(items);
}

function fashionItemName(): string {
  const items = ['Leather Jacket','Silk Blouse','Cargo Pants','Wool Overcoat','Denim Jeaker','Linen Shirt','Velvet Dress','Canvas Sneakers','Cashmere Sweater','Tailored Blazer','Pleated Skirt','Graphic Tee','High-Waist Jeans','Puffer Vest','Satin Scarf'];
  return pick(items);
}

async function seed() {
  const pool = new pg.Pool(dbConfig);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // -------------------------------------------------------------------
    // 0. CLEANUP — remove all existing data (order matters for FKs)
    // -------------------------------------------------------------------
    await client.query('DELETE FROM marketplace_listings');
    await client.query('DELETE FROM commission_assets');
    await client.query('DELETE FROM commissions');
    await client.query('DELETE FROM workflows');
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM asset_output_versions');
    await client.query('DELETE FROM asset_outputs');
    await client.query('DELETE FROM asset_permissions');
    await client.query('DELETE FROM assets');
    await client.query('DELETE FROM ledger');
    await client.query('DELETE FROM wallets');
    await client.query('DELETE FROM api_keys');
    await client.query('DELETE FROM accounts');
    await client.query('DELETE FROM taxonomy');
    await client.query('DELETE FROM models');
    await client.query('DELETE FROM workspaces');

    // -------------------------------------------------------------------
    // 1. WORKSPACES
    // -------------------------------------------------------------------
    const studioWsId  = uid();
    const clientWsId  = uid();
    const clientWs2Id = uid();

    await client.query(
      `INSERT INTO workspaces (id, name, slug, workspace_type, created_at)
       VALUES ($1,$2,$3,$4,NOW()),($5,$6,$7,$8,NOW()),($9,$10,$11,$12,NOW())`,
      [
        studioWsId,  'Cast Studio',    'cast-studio',    'STUDIO',
        clientWsId,  'Brand Client A', 'brand-client-a', 'CLIENT',
        clientWs2Id, 'Brand Client B', 'brand-client-b', 'CLIENT',
      ],
    );

    // -------------------------------------------------------------------
    // 2. ACCOUNTS
    // -------------------------------------------------------------------
    const pwd = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    const adminId   = uid();
    const artist1Id = uid(); // API-enabled
    const artist2Id = uid(); // API-enabled
    const artist3Id = uid();
    const clientId  = uid();
    const client2Id = uid();

    const accounts = [
      { id: adminId,   ws: studioWsId,  name: 'Admin User',    email: 'admin@cast.studio',     role: 'ADMIN',   api: false },
      { id: artist1Id, ws: studioWsId,  name: 'API Artist',    email: 'api-artist@cast.studio', role: 'ARTIST',  api: true  },
      { id: artist2Id, ws: studioWsId,  name: 'Jane Artist',   email: 'jane@cast.studio',       role: 'ARTIST',  api: true  },
      { id: artist3Id, ws: studioWsId,  name: 'Mika Artist',   email: 'mika@cast.studio',       role: 'ARTIST',  api: false },
      { id: clientId,  ws: clientWsId,  name: 'Client User',   email: 'client@cast.studio',     role: 'CLIENT',  api: false },
      { id: client2Id, ws: clientWs2Id, name: 'Client User B', email: 'client-b@cast.studio',   role: 'CLIENT',  api: false },
    ];

    for (const a of accounts) {
      await client.query(
        `INSERT INTO accounts (id, workspace_id, name, email, role, is_api_able, password_hash, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
        [a.id, a.ws, a.name, a.email, a.role, a.api, pwd],
      );
    }

    // -------------------------------------------------------------------
    // 3. API KEYS
    // -------------------------------------------------------------------
    for (const [idx, aid] of [artist1Id, artist2Id].entries()) {
      const raw = `cs_live_${uid().replace(/-/g,'')}`;
      const hash = await bcrypt.hash(raw, SALT_ROUNDS);
      await client.query(
        `INSERT INTO api_keys (id, account_id, key_hash, name, is_active, created_at)
         VALUES ($1,$2,$3,$4,true,NOW())`,
        [uid(), aid, hash, `Dev API Key ${idx + 1}`],
      );
    }

    // -------------------------------------------------------------------
    // 4. WALLETS + LEDGER
    // -------------------------------------------------------------------
    const walletC1Id     = uid();
    const walletC2Id     = uid();
    const walletStudioId = uid();

    const wallets = [
      { id: walletC1Id,     ws: clientWsId,  acct: clientId,  bal: '250.00' },
      { id: walletC2Id,     ws: clientWs2Id, acct: client2Id, bal: '75.50' },
      { id: walletStudioId, ws: studioWsId,  acct: artist1Id, bal: '10.00' },
    ];

    for (const w of wallets) {
      await client.query(
        `INSERT INTO wallets (id, workspace_id, account_id, balance_credits, updated_at)
         VALUES ($1,$2,$3,$4,NOW())`,
        [w.id, w.ws, w.acct, w.bal],
      );
      await client.query(
        `INSERT INTO ledger (id, workspace_id, wallet_id, amount, type, created_at)
         VALUES ($1,$2,$3,$4,'TOP_UP',NOW())`,
        [uid(), w.ws, w.id, w.bal],
      );
    }

    // -------------------------------------------------------------------
    // 5. TAXONOMY
    // -------------------------------------------------------------------
    const taxonomyEntries: Array<{cat:string;key:string;label:string;type:string;req:boolean;opts:string|null;sort:number}> = [
      // Actor properties
      { cat: 'actor', key: 'age',       label: 'Age',           type: 'range',  req: true,  opts: JSON.stringify({ min: 18, max: 80 }), sort: 1 },
      { cat: 'actor', key: 'gender',    label: 'Gender',        type: 'select', req: true,  opts: JSON.stringify(['Female','Male','Non-Binary']), sort: 2 },
      { cat: 'actor', key: 'ethnicity', label: 'Ethnicity',     type: 'select', req: false, opts: JSON.stringify(['East Asian','South Asian','Black','White','Latino','Middle Eastern','Mixed']), sort: 3 },
      { cat: 'actor', key: 'body_type', label: 'Body Type',     type: 'select', req: false, opts: JSON.stringify(['Slim','Athletic','Average','Curvy','Muscular']), sort: 4 },
      { cat: 'actor', key: 'vibe',      label: 'Vibe',          type: 'text',   req: false, opts: null, sort: 5 },
      // Look taxonomy
      { cat: 'look', key: 'gender',   label: 'Gender',        type: 'select', req: true,  opts: JSON.stringify(['Female','Male','Unisex']), sort: 1 },
      { cat: 'look', key: 'style',    label: 'Style',         type: 'select', req: true,  opts: JSON.stringify(['Streetwear','Formal','Casual','Bohemian','Athleisure','Glamour','Vintage']), sort: 2 },
      { cat: 'look', key: 'season',   label: 'Season',        type: 'select', req: false, opts: JSON.stringify(['Spring','Summer','Fall','Winter','All-Season']), sort: 3 },
      { cat: 'look', key: 'color',    label: 'Primary Color', type: 'select', req: false, opts: JSON.stringify(['Black','White','Red','Blue','Green','Yellow','Purple','Orange','Pink','Brown','Gray','Multi']), sort: 4 },
      { cat: 'look', key: 'occasion', label: 'Occasion',      type: 'select', req: false, opts: JSON.stringify(['Casual','Work','Party','Wedding','Sport','Red Carpet','Street']), sort: 5 },
      // Fashion item taxonomy
      { cat: 'fashion_item', key: 'gender',    label: 'Gender',    type: 'select', req: true,  opts: JSON.stringify(['Female','Male','Unisex']), sort: 1 },
      { cat: 'fashion_item', key: 'item_type', label: 'Item Type', type: 'select', req: true,  opts: JSON.stringify(['Jacket','Shirt','Pants','Dress','Skirt','Sweater','Shoes','Accessory','Hat','Bag']), sort: 2 },
      { cat: 'fashion_item', key: 'sub_type',  label: 'Sub-Type',  type: 'select', req: false, opts: JSON.stringify(['Outerwear','Top','Bottom','Footwear','Jewelry','Scarf','Belt','Sunglasses']), sort: 3 },
      { cat: 'fashion_item', key: 'style',     label: 'Style',     type: 'select', req: false, opts: JSON.stringify(['Casual','Formal','Streetwear','Sport','Vintage','Bohemian']), sort: 4 },
      { cat: 'fashion_item', key: 'color',     label: 'Color',     type: 'select', req: false, opts: JSON.stringify(['Black','White','Red','Blue','Green','Brown','Beige','Gray','Multi']), sort: 5 },
      { cat: 'fashion_item', key: 'season',    label: 'Season',    type: 'select', req: false, opts: JSON.stringify(['Spring','Summer','Fall','Winter','All-Season']), sort: 6 },
    ];

    for (const t of taxonomyEntries) {
      const tid = uid();
      await client.query(
        `INSERT INTO taxonomy (id, workspace_id, category, key, label, input_type, options, is_required, sort_order, is_active, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,NOW())`,
        [tid, studioWsId, t.cat, t.key, t.label, t.type, t.opts, t.req, t.sort],
      );
    }

    // -------------------------------------------------------------------
    // 6. MODELS (AI models)
    // -------------------------------------------------------------------
    const modelDefs = [
      { mid: 'flux-pro',         name: 'FLUX Pro',         type: 'image',  task: 'text-to-image' },
      { mid: 'flux-pro-img2img', name: 'FLUX Pro Img2Img', type: 'image',  task: 'image-to-image' },
      { mid: 'sdxl-turbo',       name: 'SDXL Turbo',       type: 'image',  task: 'text-to-image' },
      { mid: 'kling-v1',         name: 'Kling v1',         type: 'video',  task: 'image-to-video' },
      { mid: 'runway-gen3',      name: 'Runway Gen-3',     type: 'video',  task: 'image-to-video' },
      { mid: 'gpt-4-vision',     name: 'GPT-4 Vision',     type: 'vision', task: 'image-analysis' },
    ];

    for (const m of modelDefs) {
      await client.query(
        `INSERT INTO models (id, model_id, name, model_type, task, parameters, is_active, created_at)
         VALUES ($1,$2,$3,$4,$5,'{}',true,NOW())`,
        [uid(), m.mid, m.name, m.type, m.task],
      );
    }

    // -------------------------------------------------------------------
    // Helper: insert asset + outputs
    // -------------------------------------------------------------------
    const insertAsset = async (
      name: string,
      type: string,
      seed: number,
      recipe: string,
      creatorId: string,
      wsId: string,
      mktStatus: string | null,
      mktFrozen: boolean,
      sourceType: string,
      clientId: string | null,
      layouts: string[],
    ): Promise<string> {
      const assetId = uid();
      await client.query(
        `INSERT INTO assets (id, workspace_id, creator_id, client_id, asset_type, name, seed,
          prompt_recipe, marketplace_status, is_marketplace_frozen, source_asset_id, source_type, created_at)
         VALUES ($1,$2,$3,$4::uuid,$5,$6,$7,$8,$9,$10,null::uuid,$11,NOW())`,
        [assetId, wsId, creatorId, clientId, type, name, seed, recipe, mktStatus, mktFrozen, sourceType],
      );
      for (const layout of layouts) {
        await client.query(
          `INSERT INTO asset_outputs (id, asset_id, layout_type, model, image_url, local_backup_url,
            cost_credits, status, version, is_obsolete, obsolete_reason, error_message,
            generation_params, reference_images, source_asset_outputs, created_at)
           VALUES ($1,$2,$3,$4,$5,null,$6,'SUCCESS',1,false,null,null,$7,null,null,NOW())`,
          [uid(), assetId, layout, 'flux-pro', `https://picsum.photos/seed/${seed}${layout.replace(/[^a-z0-9]/g,'')}/400/500`, '0.05',
            JSON.stringify({ seed, resolution: '1024x1024', steps: 30 })],
        );
      }
      return assetId;
    };

    // -------------------------------------------------------------------
    // 7. ASSETS — Actors (5)
    // -------------------------------------------------------------------
    const actorLayouts = ['headshot','fullshot','expressions_3x4','editorial','character_sheet'];
    const actorMktStatuses: (string|null)[] = ['APPROVED','APPROVED','APPROVED','PENDING', null];
    const actorFrozen = [true, true, false, false, false];
    const actorIds: string[] = [];

    for (let i = 0; i < 5; i++) {
      const aid = await insertAsset(
        actorName(), 'ACTOR', 10000 + i * 1111,
        JSON.stringify({ identity: { age: 20 + i * 5, gender: i % 2 === 0 ? 'female' : 'male', ethnicity: pick(['east_asian','south_asian','black','white','latino']) } }),
        pick([artist1Id, artist2Id, artist3Id]),
        studioWsId,
        actorMktStatuses[i],
        actorFrozen[i],
        'ORIGINAL',
        null,
        actorLayouts,
      );
      actorIds.push(aid);
    }

    // -------------------------------------------------------------------
    // 8. ASSETS — Looks (4)
    // -------------------------------------------------------------------
    const lookMktStatuses: (string|null)[] = ['APPROVED','APPROVED','PENDING', null];
    const lookFrozen = [true, false, false, false];
    const lookIds: string[] = [];

    for (let i = 0; i < 4; i++) {
      const lid = await insertAsset(
        lookName(), 'LOOK', 20000 + i * 2222,
        JSON.stringify({ style: pick(['streetwear','formal','casual','bohemian']), items: [pick(['jacket','shirt','pants','dress','skirt'])] }),
        pick([artist1Id, artist2Id, artist3Id]),
        studioWsId,
        lookMktStatuses[i],
        lookFrozen[i],
        'ORIGINAL',
        null,
        ['look'],
      );
      lookIds.push(lid);
    }

    // -------------------------------------------------------------------
    // 9. ASSETS — Fashion Items (4)
    // -------------------------------------------------------------------
    const fiMktStatuses: (string|null)[] = ['APPROVED', null, null, null];
    const fiIds: string[] = [];

    for (let i = 0; i < 4; i++) {
      const fid = await insertAsset(
        fashionItemName(), 'FASHION_ITEM', 30000 + i * 3333,
        JSON.stringify({ item_type: pick(['jacket','shirt','pants','dress','shoes']), material: pick(['leather','cotton','silk','denim','wool']), color: pick(['black','white','red','blue','brown']) }),
        pick([artist1Id, artist2Id, artist3Id]),
        studioWsId,
        fiMktStatuses[i],
        false,
        'ORIGINAL',
        null,
        ['fashion_item'],
      );
      fiIds.push(fid);
    }

    // -------------------------------------------------------------------
    // 10. ASSET OUTPUT VERSIONS (version history for first actor headshot)
    // -------------------------------------------------------------------
    const aoResult = await client.query(
      `SELECT id FROM asset_outputs WHERE asset_id = $1 AND layout_type = 'headshot'`,
      [actorIds[0]],
    );
    if (aoResult.rows.length > 0) {
      const aoId = aoResult.rows[0].id;
      for (let v = 1; v <= 3; v++) {
        await client.query(
          `INSERT INTO asset_output_versions (id, asset_output_id, version, image_url, local_backup_url,
            model, cost_credits, status, generation_params, reference_images, source_asset_outputs,
            error_message, created_at)
           VALUES ($1,$2,$3,$4,null,$5,$6,'SUCCESS',$7,null,null,null,NOW())`,
          [uid(), aoId, v, `https://picsum.photos/seed/v${v}/400/500`, 'flux-pro', '0.05',
            JSON.stringify({ seed: 10000, resolution: '1024x1024', steps: 30 })],
        );
      }
    }

    // -------------------------------------------------------------------
    // 11. ASSET PERMISSIONS
    // -------------------------------------------------------------------
    await client.query(
      `INSERT INTO asset_permissions (id, asset_id, grantee_id, granted_at, revoked_at)
       VALUES ($1,$2,$3,NOW(),null)`,
      [uid(), actorIds[1], clientId],
    );
    await client.query(
      `INSERT INTO asset_permissions (id, asset_id, grantee_id, granted_at, revoked_at)
       VALUES ($1,$2,$3,NOW(),null)`,
      [uid(), lookIds[0], clientId],
    );
    await client.query(
      `INSERT INTO asset_permissions (id, asset_id, grantee_id, granted_at, revoked_at)
       VALUES ($1,$2,$3,NOW(),NOW())`,
      [uid(), actorIds[2], clientId],
    );

    // -------------------------------------------------------------------
    // 12. COMMISSIONS
    // -------------------------------------------------------------------
    const commissionDefs = [
      { title: 'Summer Campaign Lookbook',  status: 'REQUESTED',   assignee: artist2Id, premium: '50.00'  },
      { title: 'Brand Hero Actor Package',  status: 'IN_PROGRESS', assignee: artist1Id, premium: '120.00' },
      { title: 'Editorial Fashion Series',  status: 'SUBMITTED',   assignee: artist3Id, premium: '200.00' },
      { title: 'Product Launch Wardrobe',   status: 'APPROVED',    assignee: artist2Id, premium: '80.00'  },
    ];
    const commissionIds: string[] = [];

    for (const c of commissionDefs) {
      const cid = uid();
      commissionIds.push(cid);
      const isSubmitted = c.status === 'SUBMITTED' || c.status === 'APPROVED';
      const isApproved  = c.status === 'APPROVED';
      await client.query(
        `INSERT INTO commissions (id, client_workspace_id, studio_workspace_id, client_id, assignee_id,
          title, brief, status, premium_cost, submitted_at, approved_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,${isSubmitted ? 'NOW()' : 'NULL'},${isApproved ? 'NOW()' : 'NULL'},NOW())`,
        [cid, clientWsId, studioWsId, clientId, c.assignee, c.title,
         JSON.stringify({ description: `${c.title} brief`, requirements: ['headshot','fullshot'] }),
         c.status, c.premium],
      );
    }

    // -------------------------------------------------------------------
    // 13. COMMISSION ASSETS
    // -------------------------------------------------------------------
    await client.query(
      `INSERT INTO commission_assets (id, commission_id, asset_id, asset_output_id, created_at)
       VALUES ($1,$2,$3,null,NOW())`,
      [uid(), commissionIds[0], actorIds[0]],
    );
    await client.query(
      `INSERT INTO commission_assets (id, commission_id, asset_id, asset_output_id, created_at)
       VALUES ($1,$2,$3,null,NOW())`,
      [uid(), commissionIds[1], actorIds[1]],
    );
    await client.query(
      `INSERT INTO commission_assets (id, commission_id, asset_id, asset_output_id, created_at)
       VALUES ($1,$2,$3,null,NOW())`,
      [uid(), commissionIds[3], lookIds[0]],
    );

    // -------------------------------------------------------------------
    // 14. WORKFLOWS
    // -------------------------------------------------------------------
    const workflowDefs = [
      { agent: artist1Id, escrow: '25.00', consumed: '15.00', status: 'RUNNING',   errCode: null, errReason: null },
      { agent: artist2Id, escrow: '50.00', consumed: '50.00', status: 'COMPLETED', errCode: null, errReason: null },
      { agent: artist1Id, escrow: '10.00', consumed: '12.00', status: 'FAILED',    errCode: 'INSUFFICIENT_CREDITS', errReason: 'Agent run exceeded allocated credits' },
    ];

    for (const wf of workflowDefs) {
      const isDone = wf.status === 'COMPLETED' || wf.status === 'FAILED';
      await client.query(
        `INSERT INTO workflows (id, workspace_id, agent_id, wallet_id, total_escrow, consumed_credits,
          status, error_code, error_reason, created_at, completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),${isDone ? 'NOW()' : 'NULL'})`,
        [uid(), studioWsId, wf.agent, walletStudioId, wf.escrow, wf.consumed, wf.status, wf.errCode, wf.errReason],
      );
    }

    // -------------------------------------------------------------------
    // 15. NOTIFICATIONS
    // -------------------------------------------------------------------
    const notifDefs = [
      { recipient: clientId,  type: 'COMMISSION_UPDATE',   title: 'Commission approved',        message: 'Your commission "Product Launch Wardrobe" has been approved.', read: false },
      { recipient: clientId,  type: 'ASSET_SHARED',        title: 'Asset shared with you',      message: 'An actor has been shared with you by Jane Artist.', read: false },
      { recipient: clientId,  type: 'WALLET_TOPUP',        title: 'Wallet credited',            message: '250.00 credits have been added to your wallet.', read: true },
      { recipient: artist2Id, type: 'COMMISSION_ASSIGNED', title: 'New commission assigned',    message: 'You have been assigned "Summer Campaign Lookbook".', read: false },
      { recipient: artist1Id, type: 'WORKFLOW_COMPLETE',   title: 'Workflow completed',         message: 'Your generation workflow has completed successfully.', read: true },
      { recipient: artist3Id, type: 'MARKETPLACE_SUBMIT',  title: 'Marketplace submission',      message: 'Your asset has been submitted for marketplace review.', read: false },
      { recipient: adminId,   type: 'SYSTEM_ALERT',        title: 'New user registered',        message: 'A new artist has registered in the studio workspace.', read: true },
      { recipient: client2Id, type: 'COMMISSION_UPDATE',   title: 'Commission update',          message: 'A commission you follow has been updated.', read: false },
    ];

    for (const n of notifDefs) {
      await client.query(
        `INSERT INTO notifications (id, recipient_id, type, title, message, is_read, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
        [uid(), n.recipient, n.type, n.title, n.message, n.read],
      );
    }

    // -------------------------------------------------------------------
    // 16. MARKETPLACE LISTINGS
    // -------------------------------------------------------------------
    const listingDefs: Array<{
      assetId: string; sellerId: string; price: string;
      ltype: string; active: boolean; purchasedBy: string|null;
    }> = [
      // Active listings
      { assetId: actorIds[0], sellerId: artist2Id, price: '10.00', ltype: 'ACTOR_PACKAGE',  active: true,  purchasedBy: null },
      { assetId: actorIds[1], sellerId: artist1Id, price: '15.00', ltype: 'ACTOR_PACKAGE',  active: true,  purchasedBy: null },
      { assetId: lookIds[0],  sellerId: artist3Id, price: '8.00',  ltype: 'LOOK',           active: true,  purchasedBy: null },
      { assetId: lookIds[1],  sellerId: artist2Id, price: '12.00', ltype: 'LOOK',           active: true,  purchasedBy: null },
      { assetId: fiIds[0],    sellerId: artist1Id, price: '20.00', ltype: 'FASHION_ITEM',   active: true,  purchasedBy: null },
      // Purchased listings
      { assetId: actorIds[2], sellerId: artist3Id, price: '5.00',  ltype: 'ACTOR_PACKAGE',  active: false, purchasedBy: client2Id },
      { assetId: lookIds[2],  sellerId: artist2Id, price: '7.50',  ltype: 'LOOK',           active: false, purchasedBy: clientId },
      // Inactive listing
      { assetId: fiIds[1],    sellerId: artist3Id, price: '18.00', ltype: 'FASHION_ITEM',   active: false, purchasedBy: null },
    ];

    for (const l of listingDefs) {
      const isPurchased = l.purchasedBy !== null;
      await client.query(
        `INSERT INTO marketplace_listings (id, asset_id, seller_id, price_credits, listing_type, is_active, purchased_by, purchased_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,${isPurchased ? 'NOW()' : 'NULL'},NOW())`,
        [uid(), l.assetId, l.sellerId, l.price, l.ltype, l.active, l.purchasedBy],
      );
    }

    // -------------------------------------------------------------------
    // COMMIT
    // -------------------------------------------------------------------
    await client.query('COMMIT');

    console.log('Seed data created successfully.\n');
    console.log('=== Credentials ===');
    console.log(`Admin:      admin@cast.studio / ${DEFAULT_PASSWORD}`);
    console.log(`API Artist: api-artist@cast.studio / ${DEFAULT_PASSWORD} (API-enabled)`);
    console.log(`Jane:       jane@cast.studio / ${DEFAULT_PASSWORD} (API-enabled)`);
    console.log(`Mika:       mika@cast.studio / ${DEFAULT_PASSWORD}`);
    console.log(`Client A:   client@cast.studio / ${DEFAULT_PASSWORD}`);
    console.log(`Client B:   client-b@cast.studio / ${DEFAULT_PASSWORD}`);
    console.log('\n=== Summary ===');
    console.log('Workspaces:        3 (1 studio, 2 client)');
    console.log('Accounts:          6 (1 admin, 3 artists, 2 clients)');
    console.log('API Keys:          2');
    console.log('Wallets:           3');
    console.log('Actors:            5 (5 outputs each = 25 asset_outputs)');
    console.log('Looks:             4 (1 output each)');
    console.log('Fashion Items:     4 (1 output each)');
    console.log('Output Versions:   3 (first actor headshot)');
    console.log('Permissions:       3 (2 active, 1 revoked)');
    console.log('Commissions:       4 (REQUESTED, IN_PROGRESS, SUBMITTED, APPROVED)');
    console.log('Commission Assets: 3');
    console.log('Workflows:         3 (RUNNING, COMPLETED, FAILED)');
    console.log('Notifications:     8');
    console.log('Models:            6');
    console.log('Taxonomy:          16 entries');
    console.log('Marketplace:       8 listings (5 active, 2 purchased, 1 inactive)');

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
