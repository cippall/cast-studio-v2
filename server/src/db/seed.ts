/**
 * Seed script for Cast Studio v2 development database.
 *
 * Creates a comprehensive dataset so no page in the UI is empty.
 * Every list page has 20+ items. Every status/state is represented.
 * Every asset type, source type, permission state, and edge case is covered.
 *
 * Usage:  npx tsx src/db/seed.ts
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { dbConfig } from './config.js';

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = '***';

const uid = () => randomUUID();

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Name generators
// ---------------------------------------------------------------------------
const actorVibes = [
  'Cyberpunk',
  'Noir',
  'Glamour',
  'Streetwear',
  'Bohemian',
  'Minimalist',
  'Avant-Garde',
  'Retro',
  'Ethereal',
  'Industrial',
  'Romantic',
  'Futuristic',
  'Classic',
  'Edgy',
  'Whimsical',
  'Dark',
  'Pastel',
  'Tropical',
  'Gothic',
  'Preppy',
];
const actorGenders = ['Woman', 'Man', 'Non-Binary'];

function actorName(): string {
  return `${pick(actorVibes)} ${pick(actorGenders)} ${Math.floor(Math.random() * 900) + 100}`;
}

const lookNames = [
  'Neon Streetwear',
  'Midnight Gala',
  'Urban Explorer',
  'Desert Nomad',
  'Arctic Tech',
  'Vintage Denim',
  'Power Suit',
  'Festival Wear',
  'Athleisure Luxe',
  'Cyber Casual',
  'Coastal Breeze',
  'Grunge Revival',
  'Monochrome Chic',
  'Tropical Punch',
  'Gothic Velvet',
  'Pastel Dream',
  'Military Utility',
  'Bohemian Rhapsody',
  'Corporate Edge',
  'Punk Rebellion',
  'Soft Romance',
  'Tech Wear',
  'Cottage Core',
  'Y2K Revival',
  'Dark Academia',
];

const fashionItemNames = [
  'Leather Jacket',
  'Silk Blouse',
  'Cargo Pants',
  'Wool Overcoat',
  'Denim Jeaker',
  'Linen Shirt',
  'Velvet Dress',
  'Canvas Sneakers',
  'Cashmere Sweater',
  'Tailored Blazer',
  'Pleated Skirt',
  'Graphic Tee',
  'High-Waist Jeans',
  'Puffer Vest',
  'Satin Scarf',
  'Oversized Hoodie',
  'Bomber Jacket',
  'Maxi Dress',
  'Wide-Leg Trousers',
  'Crop Top',
  'Trench Coat',
  'Slip Dress',
  'Joggers',
  'Button-Down Shirt',
  'Mini Skirt',
  'Knit Cardigan',
  'Platform Boots',
  'Mesh Top',
  'Corset Belt',
];

const commissionTitles = [
  'Summer Campaign Lookbook',
  'Brand Hero Actor Package',
  'Editorial Fashion Series',
  'Product Launch Wardrobe',
  'Holiday Collection Shoot',
  'Social Media Campaign',
  'Lookbook Spring 2026',
  'Brand Ambassador Casting',
  'Music Video Wardrobe',
  'Catalog Model Selection',
  'Runway Show Casting',
  'Ad Campaign Characters',
  'Website Hero Images',
  'Billboard Campaign',
  'Influencer Collab Shoot',
  'Product Packaging Models',
  'Event Staff Casting',
  'Corporate Headshots',
  'Fashion Week Prep',
  'E-commerce Model Set',
  'Lifestyle Campaign',
  'Street Style Collection',
  'Luxury Brand Editorial',
  'Sports Brand Campaign',
];

async function seed() {
  const pool = new pg.Pool(dbConfig);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // -------------------------------------------------------------------
    // 0. CLEANUP
    // -------------------------------------------------------------------
    await client.query('DELETE FROM marketplace_listings');
    await client.query('DELETE FROM commission_assets');
    await client.query('DELETE FROM commissions');
    await client.query('DELETE FROM ledger');
    await client.query('DELETE FROM workflows');
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM asset_output_versions');
    await client.query('DELETE FROM asset_outputs');
    await client.query('DELETE FROM asset_permissions');
    await client.query('DELETE FROM assets');
    await client.query('DELETE FROM wallets');
    await client.query('DELETE FROM api_keys');
    await client.query('DELETE FROM accounts');
    await client.query('DELETE FROM taxonomy');
    await client.query('DELETE FROM models');
    await client.query('DELETE FROM workspaces');

    // -------------------------------------------------------------------
    // 1. WORKSPACES (1 studio + 3 client)
    // -------------------------------------------------------------------
    const studioWsId = uid();
    const clientWs1Id = uid();
    const clientWs2Id = uid();
    const clientWs3Id = uid();

    await client.query(
      `INSERT INTO workspaces (id, name, slug, workspace_type, created_at)
       VALUES ($1,$2,$3,$4,NOW()),($5,$6,$7,$8,NOW()),($9,$10,$11,$12,NOW()),($13,$14,$15,$16,NOW())`,
      [
        studioWsId,
        'Cast Studio',
        'cast-studio',
        'STUDIO',
        clientWs1Id,
        'Brand Client A',
        'brand-client-a',
        'CLIENT',
        clientWs2Id,
        'Brand Client B',
        'brand-client-b',
        'CLIENT',
        clientWs3Id,
        'Agency Client C',
        'agency-client-c',
        'CLIENT',
      ],
    );

    // -------------------------------------------------------------------
    // 2. ACCOUNTS (1 admin, 5 artists, 3 clients)
    // -------------------------------------------------------------------
    const pwd = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    const adminId = uid();
    const artist1Id = uid();
    const artist2Id = uid();
    const artist3Id = uid();
    const artist4Id = uid();
    const artist5Id = uid();
    const client1Id = uid();
    const client2Id = uid();
    const client3Id = uid();

    const accounts = [
      {
        id: adminId,
        ws: studioWsId,
        name: 'Admin User',
        email: 'admin@cast.studio',
        role: 'ADMIN',
        api: false,
      },
      {
        id: artist1Id,
        ws: studioWsId,
        name: 'API Artist',
        email: 'api-artist@cast.studio',
        role: 'ARTIST',
        api: true,
      },
      {
        id: artist2Id,
        ws: studioWsId,
        name: 'Jane Artist',
        email: 'jane@cast.studio',
        role: 'ARTIST',
        api: true,
      },
      {
        id: artist3Id,
        ws: studioWsId,
        name: 'Mika Artist',
        email: 'mika@cast.studio',
        role: 'ARTIST',
        api: false,
      },
      {
        id: artist4Id,
        ws: studioWsId,
        name: 'Rio Artist',
        email: 'rio@cast.studio',
        role: 'ARTIST',
        api: false,
      },
      {
        id: artist5Id,
        ws: studioWsId,
        name: 'Sage Artist',
        email: 'sage@cast.studio',
        role: 'ARTIST',
        api: false,
      },
      {
        id: client1Id,
        ws: clientWs1Id,
        name: 'Client User',
        email: 'client@cast.studio',
        role: 'CLIENT',
        api: false,
      },
      {
        id: client2Id,
        ws: clientWs2Id,
        name: 'Client User B',
        email: 'client-b@cast.studio',
        role: 'CLIENT',
        api: false,
      },
      {
        id: client3Id,
        ws: clientWs3Id,
        name: 'Client User C',
        email: 'client-c@cast.studio',
        role: 'CLIENT',
        api: false,
      },
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
      const raw = `cs_live_${uid().replace(/-/g, '')}`;
      const hash = await bcrypt.hash(raw, SALT_ROUNDS);
      await client.query(
        `INSERT INTO api_keys (id, account_id, key_hash, name, is_active, created_at, last_used_at)
         VALUES ($1,$2,$3,$4,true,NOW(),NOW())`,
        [uid(), aid, hash, `API Key ${idx + 1} - ${idx === 0 ? 'Production' : 'Development'}`],
      );
    }
    // One revoked key
    {
      const hash = await bcrypt.hash('cs_live_revoked_key', SALT_ROUNDS);
      await client.query(
        `INSERT INTO api_keys (id, account_id, key_hash, name, is_active, created_at, last_used_at)
         VALUES ($1,$2,$3,$4,false,NOW(),NULL)`,
        [uid(), artist1Id, hash, 'Old Revoked Key'],
      );
    }

    // -------------------------------------------------------------------
    // 4. WALLETS + LEDGER
    // -------------------------------------------------------------------
    const walletC1Id = uid();
    const walletC2Id = uid();
    const walletC3Id = uid();
    const walletStudioId = uid();

    const wallets = [
      { id: walletC1Id, ws: clientWs1Id, acct: client1Id, bal: '500.00' },
      { id: walletC2Id, ws: clientWs2Id, acct: client2Id, bal: '75.50' },
      { id: walletC3Id, ws: clientWs3Id, acct: client3Id, bal: '1200.00' },
      { id: walletStudioId, ws: studioWsId, acct: artist1Id, bal: '10.00' },
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

    // CHARGE entries
    for (let i = 0; i < 15; i++) {
      const amt = -(Math.random() * 2 + 0.01).toFixed(4);
      await client.query(
        `INSERT INTO ledger (id, workspace_id, wallet_id, amount, type, created_at)
         VALUES ($1,$2,$3,$4,'CHARGE',NOW())`,
        [uid(), clientWs1Id, walletC1Id, amt],
      );
    }

    // ESCROW_HOLD and ESCROW_REFUND
    await client.query(
      `INSERT INTO ledger (id, workspace_id, wallet_id, amount, type, created_at)
       VALUES ($1,$2,$3,$4,'ESCROW_HOLD',NOW())`,
      [uid(), clientWs1Id, walletC1Id, '-25.0000'],
    );
    await client.query(
      `INSERT INTO ledger (id, workspace_id, wallet_id, amount, type, created_at)
       VALUES ($1,$2,$3,$4,'ESCROW_REFUND',NOW())`,
      [uid(), clientWs1Id, walletC1Id, '10.0000'],
    );

    // -------------------------------------------------------------------
    // 5. TAXONOMY (72 entries across 4 categories + 2 global)
    // -------------------------------------------------------------------
    const taxonomyEntries: Array<{
      wsId: string | null;
      cat: string;
      key: string;
      label: string;
      inputType: string;
      opts: string | null;
      req: boolean;
      sort: number;
    }> = [];

    // ACTOR_PROPERTY (20 entries)
    const actorProps = [
      {
        key: 'age',
        label: 'Age',
        inputType: 'SLIDER',
        opts: '{"min":18,"max":80,"step":1}',
        req: true,
      },
      {
        key: 'gender',
        label: 'Gender',
        inputType: 'DROPDOWN',
        opts: '["Female","Male","Non-Binary"]',
        req: true,
      },
      {
        key: 'ethnicity',
        label: 'Ethnicity',
        inputType: 'DROPDOWN',
        opts: '["East Asian","South Asian","Black","White","Latino","Middle Eastern","Mixed"]',
        req: false,
      },
      {
        key: 'body_type',
        label: 'Body Type',
        inputType: 'DROPDOWN',
        opts: '["Slim","Athletic","Average","Curvy","Muscular","Plus Size"]',
        req: false,
      },
      {
        key: 'height_cm',
        label: 'Height (cm)',
        inputType: 'SLIDER',
        opts: '{"min":140,"max":210,"step":1}',
        req: false,
      },
      {
        key: 'hair_color',
        label: 'Hair Color',
        inputType: 'DROPDOWN',
        opts: '["Black","Brown","Blonde","Red","Gray","White","Blue","Pink","Green","Purple","Bald"]',
        req: false,
      },
      {
        key: 'hair_length',
        label: 'Hair Length',
        inputType: 'DROPDOWN',
        opts: '["Bald","Buzz Cut","Short","Medium","Long","Very Long"]',
        req: false,
      },
      {
        key: 'hair_style',
        label: 'Hair Style',
        inputType: 'DROPDOWN',
        opts: '["Straight","Wavy","Curly","Coily","Braided","Dreadlocks","Ponytail","Bun","Mohawk"]',
        req: false,
      },
      {
        key: 'eye_color',
        label: 'Eye Color',
        inputType: 'DROPDOWN',
        opts: '["Brown","Blue","Green","Hazel","Gray","Amber"]',
        req: false,
      },
      {
        key: 'skin_tone',
        label: 'Skin Tone',
        inputType: 'DROPDOWN',
        opts: '["Fair","Light","Medium","Olive","Tan","Brown","Dark","Deep"]',
        req: false,
      },
      {
        key: 'facial_hair',
        label: 'Facial Hair',
        inputType: 'DROPDOWN',
        opts: '["None","Stubble","Goatee","Full Beard","Mustache","Sideburns"]',
        req: false,
      },
      { key: 'vibe', label: 'Vibe', inputType: 'TEXT', opts: null, req: false },
      {
        key: 'expression',
        label: 'Expression',
        inputType: 'DROPDOWN',
        opts: '["Neutral","Smiling","Serious","Intense","Playful","Mysterious"]',
        req: false,
      },
      {
        key: 'distinguishing',
        label: 'Distinguishing Marks',
        inputType: 'TEXT',
        opts: null,
        req: false,
      },
      { key: 'tattoos', label: 'Tattoos', inputType: 'CHECKBOX', opts: null, req: false },
      { key: 'piercings', label: 'Piercings', inputType: 'CHECKBOX', opts: null, req: false },
      { key: 'glasses', label: 'Glasses', inputType: 'CHECKBOX', opts: null, req: false },
      {
        key: 'makeup',
        label: 'Makeup Style',
        inputType: 'DROPDOWN',
        opts: '["None","Natural","Glam","Editorial","Avant-Garde","SFX"]',
        req: false,
      },
      {
        key: 'accessories',
        label: 'Accessories',
        inputType: 'MULTI_SELECT',
        opts: '["Earrings","Necklace","Watch","Rings","Bracelet","Hat","Scarf"]',
        req: false,
      },
      {
        key: 'special_ability',
        label: 'Special Ability',
        inputType: 'TEXT',
        opts: null,
        req: false,
      },
    ];
    actorProps.forEach((p, i) =>
      taxonomyEntries.push({ wsId: studioWsId, cat: 'ACTOR_PROPERTY', ...p, sort: i }),
    );

    // LOOK_TAXONOMY (20 entries)
    const lookTax = [
      {
        key: 'gender',
        label: 'Gender',
        inputType: 'DROPDOWN',
        opts: '["Female","Male","Unisex"]',
        req: true,
      },
      {
        key: 'style',
        label: 'Style',
        inputType: 'DROPDOWN',
        opts: '["Streetwear","Formal","Casual","Bohemian","Athleisure","Glamour","Vintage","Punk","Gothic","Preppy","Minimalist","Avant-Garde"]',
        req: true,
      },
      {
        key: 'season',
        label: 'Season',
        inputType: 'DROPDOWN',
        opts: '["Spring","Summer","Fall","Winter","All-Season"]',
        req: false,
      },
      {
        key: 'color',
        label: 'Primary Color',
        inputType: 'DROPDOWN',
        opts: '["Black","White","Red","Blue","Green","Yellow","Purple","Orange","Pink","Brown","Gray","Multi"]',
        req: false,
      },
      {
        key: 'occasion',
        label: 'Occasion',
        inputType: 'DROPDOWN',
        opts: '["Casual","Work","Party","Wedding","Sport","Red Carpet","Street","Beach","Festival"]',
        req: false,
      },
      {
        key: 'formality',
        label: 'Formality Level',
        inputType: 'SLIDER',
        opts: '{"min":1,"max":10,"step":1}',
        req: false,
      },
      {
        key: 'era',
        label: 'Era / Period',
        inputType: 'DROPDOWN',
        opts: '["Contemporary","1920s","1950s","1970s","1980s","1990s","Y2K","Futuristic"]',
        req: false,
      },
      {
        key: 'pattern',
        label: 'Pattern',
        inputType: 'DROPDOWN',
        opts: '["Solid","Striped","Plaid","Floral","Geometric","Animal Print","Camo","Tie-Dye","Graphic","None"]',
        req: false,
      },
      {
        key: 'texture',
        label: 'Texture',
        inputType: 'DROPDOWN',
        opts: '["Smooth","Ribbed","Quilted","Mesh","Fleece","Leather","Denim","Silk","Knit"]',
        req: false,
      },
      {
        key: 'fit',
        label: 'Fit',
        inputType: 'DROPDOWN',
        opts: '["Slim","Regular","Relaxed","Oversized","Cropped"]',
        req: false,
      },
      { key: 'layering', label: 'Layering', inputType: 'CHECKBOX', opts: null, req: false },
      { key: 'sheer', label: 'Sheer Fabric', inputType: 'CHECKBOX', opts: null, req: false },
      { key: 'embellished', label: 'Embellished', inputType: 'CHECKBOX', opts: null, req: false },
      { key: 'sustainable', label: 'Sustainable', inputType: 'CHECKBOX', opts: null, req: false },
      { key: 'luxury', label: 'Luxury', inputType: 'CHECKBOX', opts: null, req: false },
      { key: 'sporty', label: 'Sporty', inputType: 'CHECKBOX', opts: null, req: false },
      { key: 'vintage_wear', label: 'Vintage Wear', inputType: 'CHECKBOX', opts: null, req: false },
      { key: 'handmade', label: 'Handmade', inputType: 'CHECKBOX', opts: null, req: false },
      { key: 'custom_fit', label: 'Custom Fit', inputType: 'CHECKBOX', opts: null, req: false },
      { key: 'notes', label: 'Styling Notes', inputType: 'TEXT', opts: null, req: false },
    ];
    lookTax.forEach((p, i) =>
      taxonomyEntries.push({ wsId: studioWsId, cat: 'LOOK_TAXONOMY', ...p, sort: i }),
    );

    // FASHION_ITEM_TAXONOMY (20 entries)
    const fiTax = [
      {
        key: 'gender',
        label: 'Gender',
        inputType: 'DROPDOWN',
        opts: '["Female","Male","Unisex"]',
        req: true,
      },
      {
        key: 'item_type',
        label: 'Item Type',
        inputType: 'DROPDOWN',
        opts: '["Jacket","Shirt","Pants","Dress","Skirt","Sweater","Shoes","Accessory","Hat","Bag","Underwear","Swimwear","Outerwear"]',
        req: true,
      },
      {
        key: 'sub_type',
        label: 'Sub-Type',
        inputType: 'DROPDOWN',
        opts: '["Outerwear","Top","Bottom","Footwear","Jewelry","Scarf","Belt","Sunglasses","Watch","Gloves"]',
        req: false,
      },
      {
        key: 'style',
        label: 'Style',
        inputType: 'DROPDOWN',
        opts: '["Casual","Formal","Streetwear","Sport","Vintage","Bohemian","Minimalist","Luxury"]',
        req: false,
      },
      {
        key: 'color',
        label: 'Color',
        inputType: 'DROPDOWN',
        opts: '["Black","White","Red","Blue","Green","Brown","Beige","Gray","Multi","Metallic"]',
        req: false,
      },
      {
        key: 'season',
        label: 'Season',
        inputType: 'DROPDOWN',
        opts: '["Spring","Summer","Fall","Winter","All-Season"]',
        req: false,
      },
      {
        key: 'material',
        label: 'Material',
        inputType: 'DROPDOWN',
        opts: '["Cotton","Silk","Wool","Leather","Denim","Linen","Polyester","Cashmere","Velvet","Satin"]',
        req: false,
      },
      {
        key: 'pattern',
        label: 'Pattern',
        inputType: 'DROPDOWN',
        opts: '["Solid","Striped","Plaid","Floral","Geometric","Animal Print","Camo","Logo"]',
        req: false,
      },
      {
        key: 'fit',
        label: 'Fit',
        inputType: 'DROPDOWN',
        opts: '["Slim","Regular","Relaxed","Oversized"]',
        req: false,
      },
      {
        key: 'length',
        label: 'Length',
        inputType: 'DROPDOWN',
        opts: '["Cropped","Regular","Long","Maxi","Mini"]',
        req: false,
      },
      {
        key: 'sleeve',
        label: 'Sleeve Type',
        inputType: 'DROPDOWN',
        opts: '["Sleeveless","Short","Long","3/4 Length","Cap","Flutter"]',
        req: false,
      },
      {
        key: 'neckline',
        label: 'Neckline',
        inputType: 'DROPDOWN',
        opts: '["Crew","V-Neck","Scoop","Turtleneck","Collared","Off-Shoulder","Halter"]',
        req: false,
      },
      {
        key: 'closure',
        label: 'Closure Type',
        inputType: 'DROPDOWN',
        opts: '["Button","Zipper","Pullover","Wrap","Slip-On","Buckle"]',
        req: false,
      },
      {
        key: 'occasion',
        label: 'Occasion',
        inputType: 'MULTI_SELECT',
        opts: '["Casual","Work","Party","Wedding","Sport","Red Carpet","Street","Beach"]',
        req: false,
      },
      {
        key: 'brand_tier',
        label: 'Brand Tier',
        inputType: 'DROPDOWN',
        opts: '["Budget","Mid-Range","Premium","Luxury","Haute Couture"]',
        req: false,
      },
      { key: 'sustainable', label: 'Sustainable', inputType: 'CHECKBOX', opts: null, req: false },
      { key: 'handmade', label: 'Handmade', inputType: 'CHECKBOX', opts: null, req: false },
      { key: 'vintage', label: 'Vintage', inputType: 'CHECKBOX', opts: null, req: false },
      {
        key: 'limited_edition',
        label: 'Limited Edition',
        inputType: 'CHECKBOX',
        opts: null,
        req: false,
      },
      { key: 'notes', label: 'Item Notes', inputType: 'TEXT', opts: null, req: false },
    ];
    fiTax.forEach((p, i) =>
      taxonomyEntries.push({ wsId: studioWsId, cat: 'FASHION_ITEM_TAXONOMY', ...p, sort: i }),
    );

    // COMMISSION_FIELD (10 entries)
    const commFields = [
      {
        key: 'project_type',
        label: 'Project Type',
        inputType: 'DROPDOWN',
        opts: '["Editorial","Commercial","Lookbook","Campaign","Catalog","Runway","Social Media"]',
        req: true,
      },
      { key: 'style', label: 'Style Direction', inputType: 'TEXT', opts: null, req: true },
      {
        key: 'num_subjects',
        label: 'Number of Subjects',
        inputType: 'SLIDER',
        opts: '{"min":1,"max":20,"step":1}',
        req: true,
      },
      { key: 'deadline', label: 'Deadline', inputType: 'TEXT', opts: null, req: false },
      {
        key: 'budget_range',
        label: 'Budget Range',
        inputType: 'DROPDOWN',
        opts: '["Under 100cr","100-500cr","500-1000cr","Over 1000cr"]',
        req: false,
      },
      {
        key: 'reference_images',
        label: 'Reference Images',
        inputType: 'TEXT',
        opts: null,
        req: false,
      },
      {
        key: 'usage_rights',
        label: 'Usage Rights',
        inputType: 'MULTI_SELECT',
        opts: '["Web","Print","Social Media","Billboard","TV/Video","All Media"]',
        req: false,
      },
      { key: 'notes', label: 'Additional Notes', inputType: 'TEXT', opts: null, req: false },
      {
        key: 'priority',
        label: 'Priority',
        inputType: 'DROPDOWN',
        opts: '["Low","Normal","High","Urgent"]',
        req: false,
      },
      { key: 'nda_required', label: 'NDA Required', inputType: 'CHECKBOX', opts: null, req: false },
    ];
    commFields.forEach((p, i) =>
      taxonomyEntries.push({ wsId: studioWsId, cat: 'COMMISSION_FIELD', ...p, sort: i }),
    );

    // Global taxonomy (workspace_id = NULL)
    taxonomyEntries.push({
      wsId: null,
      cat: 'ACTOR_PROPERTY',
      key: 'global_vibe',
      label: 'Global Vibe',
      inputType: 'TEXT',
      opts: null,
      req: false,
      sort: 99,
    });
    taxonomyEntries.push({
      wsId: null,
      cat: 'LOOK_TAXONOMY',
      key: 'global_mood',
      label: 'Global Mood',
      inputType: 'TEXT',
      opts: null,
      req: false,
      sort: 99,
    });

    for (const t of taxonomyEntries) {
      await client.query(
        `INSERT INTO taxonomy (id, workspace_id, category, key, label, input_type, options, is_required, sort_order, is_active, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,NOW())`,
        [uid(), t.wsId, t.cat, t.key, t.label, t.inputType, t.opts, t.req, t.sort],
      );
    }

    // -------------------------------------------------------------------
    // 6. MODELS (10 entries, mix of active/inactive)
    // -------------------------------------------------------------------
    const modelDefs = [
      {
        mid: 'fal-ai/flux-pro',
        name: 'FLUX Pro',
        mtype: 'TEXT_TO_IMAGE',
        task: 'text_to_image',
        active: true,
      },
      {
        mid: 'fal-ai/flux-pro/v1.1-ultra',
        name: 'FLUX Pro 1.1 Ultra',
        mtype: 'TEXT_TO_IMAGE',
        task: 'text_to_image',
        active: true,
      },
      {
        mid: 'fal-ai/flux/dev',
        name: 'FLUX Dev',
        mtype: 'TEXT_TO_IMAGE',
        task: 'text_to_image',
        active: true,
      },
      {
        mid: 'fal-ai/flux/schnell',
        name: 'FLUX Schnell',
        mtype: 'TEXT_TO_IMAGE',
        task: 'text_to_image',
        active: true,
      },
      {
        mid: 'fal-ai/flux-pro/img2img',
        name: 'FLUX Pro Img2Img',
        mtype: 'IMAGE_TO_IMAGE',
        task: 'image_to_image',
        active: true,
      },
      {
        mid: 'fal-ai/sdxl-turbo',
        name: 'SDXL Turbo',
        mtype: 'TEXT_TO_IMAGE',
        task: 'text_to_image',
        active: false,
      },
      {
        mid: 'fal-ai/kling-v1',
        name: 'Kling v1',
        mtype: 'IMAGE_TO_IMAGE',
        task: 'image_to_video',
        active: true,
      },
      {
        mid: 'fal-ai/runway-gen3',
        name: 'Runway Gen-3',
        mtype: 'IMAGE_TO_IMAGE',
        task: 'image_to_video',
        active: false,
      },
      {
        mid: 'openai/gpt-4-vision',
        name: 'GPT-4 Vision',
        mtype: 'IMAGE_TO_TEXT',
        task: 'reference_extraction',
        active: true,
      },
      {
        mid: 'fal-ai/stable-cascade',
        name: 'Stable Cascade',
        mtype: 'TEXT_TO_IMAGE',
        task: 'text_to_image',
        active: false,
      },
    ];

    for (const m of modelDefs) {
      await client.query(
        `INSERT INTO models (id, model_id, name, model_type, task, parameters, is_active, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
        [uid(), m.mid, m.name, m.mtype, m.task, '{"steps":30,"guidance":7.5}', m.active],
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
      layouts: Array<{
        layout: string;
        status?: string;
        obsolete?: boolean;
        obsoleteReason?: string;
        errorMsg?: string;
      }>,
    ): Promise<string> => {
      const assetId = uid();
      await client.query(
        `INSERT INTO assets (id, workspace_id, creator_id, client_id, asset_type, name, seed,
          prompt_recipe, marketplace_status, is_marketplace_frozen, source_asset_id, source_type, deleted_at, created_at)
         VALUES ($1,$2,$3,$4::uuid,$5,$6,$7,$8,$9,$10,null::uuid,$11,null,NOW())`,
        [
          assetId,
          wsId,
          creatorId,
          clientId,
          type,
          name,
          seed,
          recipe,
          mktStatus,
          mktFrozen,
          sourceType,
        ],
      );
      for (const lo of layouts) {
        const status = lo.status || 'SUCCESS';
        const imgUrl =
          status === 'SUCCESS'
            ? `https://picsum.photos/seed/${seed}${lo.layout.replace(/[^a-z0-9]/gi, '')}/400/500`
            : null;
        const backupUrl =
          status === 'SUCCESS'
            ? `https://picsum.photos/seed/${seed}${lo.layout.replace(/[^a-z0-9]/gi, '')}_backup/400/500`
            : null;
        await client.query(
          `INSERT INTO asset_outputs (id, asset_id, layout_type, model, image_url, local_backup_url,
            cost_credits, status, version, is_obsolete, obsolete_reason, error_message,
            generation_params, reference_images, source_asset_outputs, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10,$11,$12,null,null,NOW())`,
          [
            uid(),
            assetId,
            lo.layout,
            pick(['flux-pro', 'flux-pro/v1.1-ultra', 'flux/dev', 'sdxl-turbo']),
            imgUrl,
            backupUrl,
            (Math.random() * 0.1 + 0.01).toFixed(4),
            status,
            lo.obsolete || false,
            lo.obsoleteReason || null,
            lo.errorMsg || null,
            JSON.stringify({ seed, resolution: '1024x1024', steps: 30, guidance: 7.5 }),
          ],
        );
      }
      return assetId;
    };

    // -------------------------------------------------------------------
    // 7. ASSETS — Actors (25)
    // -------------------------------------------------------------------
    const actorLayoutsFull: Array<{
      layout: string;
      status?: string;
      obsolete?: boolean;
      obsoleteReason?: string;
      errorMsg?: string;
    }> = [
      { layout: 'headshot' },
      { layout: 'fullshot' },
      { layout: 'expressions_3x4' },
      { layout: 'editorial' },
      { layout: 'character_sheet' },
    ];

    const actorMktStatuses: Array<{ status: string | null; frozen: boolean }> = [
      { status: 'MARKETPLACE_APPROVED', frozen: true },
      { status: 'MARKETPLACE_APPROVED', frozen: true },
      { status: 'MARKETPLACE_APPROVED', frozen: true },
      { status: 'MARKETPLACE_APPROVED', frozen: false },
      { status: 'MARKETPLACE_PENDING', frozen: false },
      { status: 'MARKETPLACE_PENDING', frozen: false },
      { status: 'MARKETPLACE_PENDING', frozen: false },
      { status: 'MARKETPLACE_REJECTED', frozen: false },
      { status: 'MARKETPLACE_REJECTED', frozen: false },
      { status: 'MARKETPLACE_DELISTED', frozen: false },
      ...Array(15).fill({ status: null as string | null, frozen: false }),
    ];

    const actorIds: string[] = [];
    const allArtistIds = [artist1Id, artist2Id, artist3Id, artist4Id, artist5Id];

    for (let i = 0; i < 25; i++) {
      const mkt = actorMktStatuses[i];
      const sourceType =
        i < 18 ? 'ORIGINAL' : i < 21 ? 'DUPLICATE' : i < 23 ? 'MARKETPLACE_PURCHASE' : 'COMMISSION';
      const clientIdForAsset =
        sourceType === 'MARKETPLACE_PURCHASE' ? pick([client1Id, client2Id, client3Id]) : null;

      let layouts = actorLayoutsFull;
      if (i === 0) {
        layouts = [
          { layout: 'headshot', status: 'SUCCESS' },
          { layout: 'fullshot', status: 'SUCCESS' },
          { layout: 'expressions_3x4', status: 'SUCCESS' },
          { layout: 'editorial', status: 'FAILED', errorMsg: 'Model timeout after 60s' },
          { layout: 'character_sheet', status: 'PENDING' },
        ];
      } else if (i === 1) {
        layouts = [
          { layout: 'headshot', status: 'SUCCESS' },
          {
            layout: 'fullshot',
            status: 'SUCCESS',
            obsolete: true,
            obsoleteReason: 'Headshot was regenerated. Regenerate to update.',
          },
          { layout: 'expressions_3x4', status: 'SUCCESS' },
          { layout: 'editorial', status: 'SUCCESS' },
          { layout: 'character_sheet', status: 'SUCCESS' },
        ];
      }

      const aid = await insertAsset(
        actorName(),
        'ACTOR',
        10000 + i * 1111,
        JSON.stringify({
          identity: {
            age: 18 + ((i * 3) % 62),
            gender: ['female', 'male', 'non_binary'][i % 3],
            ethnicity: pick([
              'east_asian',
              'south_asian',
              'black',
              'white',
              'latino',
              'middle_european',
              'mixed',
            ]),
            body_type: pick(['slim', 'athletic', 'average', 'curvy', 'muscular']),
            vibe: pick(['cyberpunk', 'noir', 'glam', 'edgy', 'soft', 'intense']),
          },
        }),
        pick(allArtistIds),
        studioWsId,
        mkt.status,
        mkt.frozen,
        sourceType,
        clientIdForAsset,
        layouts,
      );
      actorIds.push(aid);
    }

    // -------------------------------------------------------------------
    // 8. ASSETS — Looks (25)
    // -------------------------------------------------------------------
    const lookMktStatuses: Array<{ status: string | null; frozen: boolean }> = [
      { status: 'MARKETPLACE_APPROVED', frozen: true },
      { status: 'MARKETPLACE_APPROVED', frozen: true },
      { status: 'MARKETPLACE_APPROVED', frozen: false },
      { status: 'MARKETPLACE_PENDING', frozen: false },
      { status: 'MARKETPLACE_PENDING', frozen: false },
      { status: 'MARKETPLACE_REJECTED', frozen: false },
      { status: 'MARKETPLACE_DELISTED', frozen: false },
      ...Array(18).fill({ status: null as string | null, frozen: false }),
    ];

    const lookIds: string[] = [];
    for (let i = 0; i < 25; i++) {
      const mkt = lookMktStatuses[i];
      const sourceType =
        i < 20 ? 'ORIGINAL' : i < 22 ? 'DUPLICATE' : i < 24 ? 'MARKETPLACE_PURCHASE' : 'COMMISSION';
      const clientIdForAsset =
        sourceType === 'MARKETPLACE_PURCHASE' ? pick([client1Id, client2Id]) : null;

      const lid = await insertAsset(
        lookNames[i % lookNames.length],
        'LOOK',
        20000 + i * 2222,
        JSON.stringify({
          style: pick([
            'streetwear',
            'formal',
            'casual',
            'bohemian',
            'athleisure',
            'glamour',
            'vintage',
            'punk',
          ]),
          items: [pick(['jacket', 'shirt', 'pants', 'dress', 'skirt', 'sweater'])],
          color: pick(['black', 'white', 'red', 'blue', 'green', 'multi']),
          season: pick(['spring', 'summer', 'fall', 'winter', 'all_season']),
        }),
        pick(allArtistIds),
        studioWsId,
        mkt.status,
        mkt.frozen,
        sourceType,
        clientIdForAsset,
        [{ layout: 'look' }],
      );
      lookIds.push(lid);
    }

    // -------------------------------------------------------------------
    // 9. ASSETS — Fashion Items (30)
    // -------------------------------------------------------------------
    const fiMktStatuses: Array<{ status: string | null; frozen: boolean }> = [
      { status: 'MARKETPLACE_APPROVED', frozen: true },
      { status: 'MARKETPLACE_APPROVED', frozen: false },
      { status: 'MARKETPLACE_PENDING', frozen: false },
      { status: 'MARKETPLACE_PENDING', frozen: false },
      { status: 'MARKETPLACE_REJECTED', frozen: false },
      { status: 'MARKETPLACE_DELISTED', frozen: false },
      ...Array(24).fill({ status: null as string | null, frozen: false }),
    ];

    const fiIds: string[] = [];
    for (let i = 0; i < 30; i++) {
      const mkt = fiMktStatuses[i];
      const sourceType =
        i < 24 ? 'ORIGINAL' : i < 27 ? 'DUPLICATE' : i < 29 ? 'MARKETPLACE_PURCHASE' : 'COMMISSION';
      const clientIdForAsset =
        sourceType === 'MARKETPLACE_PURCHASE' ? pick([client1Id, client2Id, client3Id]) : null;

      const fid = await insertAsset(
        fashionItemNames[i % fashionItemNames.length],
        'FASHION_ITEM',
        30000 + i * 3333,
        JSON.stringify({
          item_type: pick([
            'jacket',
            'shirt',
            'pants',
            'dress',
            'skirt',
            'sweater',
            'shoes',
            'accessory',
            'hat',
            'bag',
          ]),
          material: pick([
            'leather',
            'cotton',
            'silk',
            'denim',
            'wool',
            'linen',
            'cashmere',
            'velvet',
          ]),
          color: pick([
            'black',
            'white',
            'red',
            'blue',
            'green',
            'brown',
            'beige',
            'gray',
            'multi',
          ]),
          style: pick(['casual', 'formal', 'streetwear', 'sport', 'vintage', 'bohemian']),
        }),
        pick(allArtistIds),
        studioWsId,
        mkt.status,
        mkt.frozen,
        sourceType,
        clientIdForAsset,
        [{ layout: 'fashion_item' }],
      );
      fiIds.push(fid);
    }

    // -------------------------------------------------------------------
    // 10. ASSET OUTPUT VERSIONS
    // -------------------------------------------------------------------
    const aoResult1 = await client.query(
      `SELECT id FROM asset_outputs WHERE asset_id = $1 AND layout_type = 'headshot'`,
      [actorIds[0]],
    );
    if (aoResult1.rows.length > 0) {
      const aoId = aoResult1.rows[0].id;
      for (let v = 1; v <= 3; v++) {
        await client.query(
          `INSERT INTO asset_output_versions (id, asset_output_id, version, image_url, local_backup_url,
            model, cost_credits, status, generation_params, reference_images, source_asset_outputs,
            error_message, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'SUCCESS',$8,null,null,null,NOW())`,
          [
            uid(),
            aoId,
            v,
            `https://picsum.photos/seed/actor0_v${v}/400/500`,
            `https://picsum.photos/seed/actor0_v${v}_backup/400/500`,
            'flux-pro',
            '0.0500',
            JSON.stringify({ seed: 10000, resolution: '1024x1024', steps: 30, version: v }),
          ],
        );
      }
    }

    const aoResult2 = await client.query(
      `SELECT id FROM asset_outputs WHERE asset_id = $1 AND layout_type = 'fullshot'`,
      [actorIds[1]],
    );
    if (aoResult2.rows.length > 0) {
      const aoId2 = aoResult2.rows[0].id;
      for (let v = 1; v <= 2; v++) {
        await client.query(
          `INSERT INTO asset_output_versions (id, asset_output_id, version, image_url, local_backup_url,
            model, cost_credits, status, generation_params, reference_images, source_asset_outputs,
            error_message, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'SUCCESS',$8,null,null,null,NOW())`,
          [
            uid(),
            aoId2,
            v,
            `https://picsum.photos/seed/actor1_fs_v${v}/400/500`,
            `https://picsum.photos/seed/actor1_fs_v${v}_backup/400/500`,
            'flux-pro',
            '0.0500',
            JSON.stringify({ seed: 11111, resolution: '1024x1024', steps: 30, version: v }),
          ],
        );
      }
    }

    // -------------------------------------------------------------------
    // 11. ASSET PERMISSIONS (18 entries)
    // -------------------------------------------------------------------
    const permTargets = [
      { assetId: actorIds[1], granteeId: client1Id, revoked: false },
      { assetId: actorIds[2], granteeId: client1Id, revoked: false },
      { assetId: actorIds[3], granteeId: client2Id, revoked: false },
      { assetId: actorIds[4], granteeId: client3Id, revoked: false },
      { assetId: actorIds[5], granteeId: client1Id, revoked: true },
      { assetId: actorIds[6], granteeId: client2Id, revoked: true },
      { assetId: lookIds[0], granteeId: client1Id, revoked: false },
      { assetId: lookIds[1], granteeId: client2Id, revoked: false },
      { assetId: lookIds[2], granteeId: client3Id, revoked: false },
      { assetId: lookIds[3], granteeId: client1Id, revoked: true },
      { assetId: fiIds[0], granteeId: client1Id, revoked: false },
      { assetId: fiIds[1], granteeId: client2Id, revoked: false },
      { assetId: fiIds[2], granteeId: client3Id, revoked: false },
      { assetId: fiIds[3], granteeId: client1Id, revoked: true },
      { assetId: actorIds[7], granteeId: artist2Id, revoked: false },
      { assetId: actorIds[8], granteeId: artist3Id, revoked: false },
      { assetId: lookIds[4], granteeId: artist1Id, revoked: false },
      { assetId: fiIds[4], granteeId: artist4Id, revoked: false },
    ];
    for (const p of permTargets) {
      await client.query(
        `INSERT INTO asset_permissions (id, asset_id, grantee_id, granted_at, revoked_at)
         VALUES ($1,$2,$3,NOW(),${p.revoked ? 'NOW()' : 'NULL'})`,
        [uid(), p.assetId, p.granteeId],
      );
    }

    // -------------------------------------------------------------------
    // 12. COMMISSIONS (24, all statuses)
    // -------------------------------------------------------------------
    const commissionStatuses = [
      'REQUESTED',
      'REQUESTED',
      'REQUESTED',
      'REQUESTED',
      'REQUESTED',
      'ASSIGNED',
      'ASSIGNED',
      'ASSIGNED',
      'IN_PROGRESS',
      'IN_PROGRESS',
      'IN_PROGRESS',
      'IN_PROGRESS',
      'SUBMITTED',
      'SUBMITTED',
      'SUBMITTED',
      'SUBMITTED',
      'CHANGES_REQUESTED',
      'CHANGES_REQUESTED',
      'APPROVED',
      'APPROVED',
      'APPROVED',
      'APPROVED',
      'CANCELLED',
      'CANCELLED',
    ];
    const commissionIds: string[] = [];
    for (let i = 0; i < commissionStatuses.length; i++) {
      const status = commissionStatuses[i];
      const cid = uid();
      commissionIds.push(cid);
      const isAssigned = [
        'ASSIGNED',
        'IN_PROGRESS',
        'SUBMITTED',
        'CHANGES_REQUESTED',
        'APPROVED',
      ].includes(status);
      const isSubmitted = ['SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED'].includes(status);
      const isApproved = status === 'APPROVED';
      await client.query(
        `INSERT INTO commissions (id, client_workspace_id, studio_workspace_id, client_id, assignee_id,
          title, brief, status, premium_cost, submitted_at, approved_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
           ${isSubmitted ? 'NOW()' : 'NULL'},${isApproved ? 'NOW()' : 'NULL'},NOW())`,
        [
          cid,
          pick([clientWs1Id, clientWs2Id, clientWs3Id]),
          studioWsId,
          pick([client1Id, client2Id, client3Id]),
          isAssigned ? pick(allArtistIds) : null,
          commissionTitles[i % commissionTitles.length],
          JSON.stringify({
            description: `Brief for commission ${i}`,
            requirements: ['headshot', 'fullshot'],
            style: pick(['cyberpunk', 'glamour', 'streetwear', 'minimalist']),
            deadline: '2026-07-15',
            budget_tier: pick(['budget', 'mid_range', 'premium', 'luxury']),
          }),
          status,
          ['REQUESTED', 'CANCELLED'].includes(status)
            ? null
            : (Math.random() * 200 + 20).toFixed(2),
        ],
      );
    }

    // -------------------------------------------------------------------
    // 13. COMMISSION ASSETS
    // -------------------------------------------------------------------
    const commAssetLinks = [
      { commIdx: 0, assetId: actorIds[0] },
      { commIdx: 1, assetId: actorIds[1] },
      { commIdx: 2, assetId: actorIds[2] },
      { commIdx: 5, assetId: actorIds[3] },
      { commIdx: 6, assetId: actorIds[4] },
      { commIdx: 7, assetId: actorIds[5] },
      { commIdx: 8, assetId: actorIds[6] },
      { commIdx: 9, assetId: actorIds[7] },
      { commIdx: 10, assetId: actorIds[8] },
      { commIdx: 11, assetId: actorIds[9] },
      { commIdx: 12, assetId: lookIds[0] },
      { commIdx: 13, assetId: lookIds[1] },
      { commIdx: 14, assetId: fiIds[0] },
      { commIdx: 15, assetId: fiIds[1] },
      { commIdx: 18, assetId: actorIds[10] },
      { commIdx: 19, assetId: actorIds[11] },
      { commIdx: 20, assetId: lookIds[5] },
      { commIdx: 22, assetId: fiIds[5] },
    ];
    for (const link of commAssetLinks) {
      await client.query(
        `INSERT INTO commission_assets (id, commission_id, asset_id, asset_output_id, created_at)
         VALUES ($1,$2,$3,null,NOW())`,
        [uid(), commissionIds[link.commIdx], link.assetId],
      );
    }

    // -------------------------------------------------------------------
    // 14. WORKFLOWS (10 entries)
    // -------------------------------------------------------------------
    const workflowDefs = [
      {
        agent: artist1Id,
        escrow: '25.0000',
        consumed: '15.5000',
        status: 'RUNNING',
        errCode: null,
        errReason: null,
      },
      {
        agent: artist2Id,
        escrow: '50.0000',
        consumed: '50.0000',
        status: 'COMPLETED',
        errCode: null,
        errReason: null,
      },
      {
        agent: artist1Id,
        escrow: '10.0000',
        consumed: '12.0000',
        status: 'FAILED',
        errCode: 'INSUFFICIENT_CREDITS',
        errReason: 'Agent run exceeded allocated credits',
      },
      {
        agent: artist3Id,
        escrow: '75.0000',
        consumed: '30.2500',
        status: 'RUNNING',
        errCode: null,
        errReason: null,
      },
      {
        agent: artist2Id,
        escrow: '100.0000',
        consumed: '100.0000',
        status: 'COMPLETED',
        errCode: null,
        errReason: null,
      },
      {
        agent: artist4Id,
        escrow: '5.0000',
        consumed: '8.0000',
        status: 'FAILED',
        errCode: 'MODEL_TIMEOUT',
        errReason: 'FLUX Pro timed out after 120s',
      },
      {
        agent: artist1Id,
        escrow: '200.0000',
        consumed: '150.0000',
        status: 'RUNNING',
        errCode: null,
        errReason: null,
      },
      {
        agent: artist5Id,
        escrow: '30.0000',
        consumed: '30.0000',
        status: 'COMPLETED',
        errCode: null,
        errReason: null,
      },
      {
        agent: artist3Id,
        escrow: '15.0000',
        consumed: '15.0000',
        status: 'FAILED',
        errCode: 'CONTENT_POLICY',
        errReason: 'Generation blocked by content policy',
      },
      {
        agent: artist2Id,
        escrow: '60.0000',
        consumed: '45.0000',
        status: 'RUNNING',
        errCode: null,
        errReason: null,
      },
    ];
    for (const wf of workflowDefs) {
      const wfId = uid();
      const isDone = wf.status === 'COMPLETED' || wf.status === 'FAILED';
      await client.query(
        `INSERT INTO workflows (id, workspace_id, agent_id, wallet_id, total_escrow, consumed_credits,
          status, error_code, error_reason, created_at, completed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),${isDone ? 'NOW()' : 'NULL'})`,
        [
          wfId,
          studioWsId,
          wf.agent,
          walletStudioId,
          wf.escrow,
          wf.consumed,
          wf.status,
          wf.errCode,
          wf.errReason,
        ],
      );
      await client.query(
        `INSERT INTO ledger (id, workspace_id, wallet_id, workflow_id, amount, type, created_at)
         VALUES ($1,$2,$3,$4,$5,'ESCROW_HOLD',NOW())`,
        [uid(), studioWsId, walletStudioId, wfId, `-${wf.escrow}`],
      );
      if (wf.status === 'COMPLETED') {
        const refund = (parseFloat(wf.escrow) - parseFloat(wf.consumed)).toFixed(4);
        if (parseFloat(refund) > 0) {
          await client.query(
            `INSERT INTO ledger (id, workspace_id, wallet_id, workflow_id, amount, type, created_at)
             VALUES ($1,$2,$3,$4,$5,'ESCROW_REFUND',NOW())`,
            [uid(), studioWsId, walletStudioId, wfId, refund],
          );
        }
      }
    }

    // -------------------------------------------------------------------
    // 15. NOTIFICATIONS (33 entries, all spec types)
    // -------------------------------------------------------------------
    const notifDefs: Array<{
      recipient: string;
      type: string;
      title: string;
      message: string;
      read: boolean;
    }> = [
      {
        recipient: client1Id,
        type: 'COMMISSION_ASSIGNED',
        title: 'New commission assigned',
        message: 'A new commission has been assigned to you.',
        read: false,
      },
      {
        recipient: client1Id,
        type: 'COMMISSION_SUBMITTED',
        title: 'Work submitted for review',
        message: 'An artist has submitted work for your commission.',
        read: false,
      },
      {
        recipient: client1Id,
        type: 'COMMISSION_APPROVED',
        title: 'Commission approved',
        message: 'Your commission has been approved.',
        read: true,
      },
      {
        recipient: client1Id,
        type: 'COMMISSION_CHANGES_REQUESTED',
        title: 'Changes requested',
        message: 'Changes were requested for your commission.',
        read: false,
      },
      {
        recipient: client1Id,
        type: 'ASSET_SHARED',
        title: 'Asset shared with you',
        message: 'An actor has been shared with you by Jane Artist.',
        read: false,
      },
      {
        recipient: client1Id,
        type: 'WORKFLOW_COMPLETED',
        title: 'Generation complete',
        message: 'Your generation workflow completed successfully.',
        read: true,
      },
      {
        recipient: client1Id,
        type: 'WORKFLOW_FAILED',
        title: 'Generation failed',
        message: 'Your generation workflow failed: Model timeout.',
        read: false,
      },
      {
        recipient: client2Id,
        type: 'COMMISSION_ASSIGNED',
        title: 'New commission assigned',
        message: 'A new commission has been assigned.',
        read: false,
      },
      {
        recipient: client2Id,
        type: 'COMMISSION_SUBMITTED',
        title: 'Work submitted for review',
        message: 'Work submitted for your commission.',
        read: true,
      },
      {
        recipient: client2Id,
        type: 'ASSET_SHARED',
        title: 'Asset shared with you',
        message: 'A look has been shared with you.',
        read: false,
      },
      {
        recipient: client2Id,
        type: 'WORKFLOW_COMPLETED',
        title: 'Generation complete',
        message: 'Your generation workflow completed.',
        read: true,
      },
      {
        recipient: client3Id,
        type: 'COMMISSION_APPROVED',
        title: 'Commission approved',
        message: 'Your commission has been approved.',
        read: false,
      },
      {
        recipient: client3Id,
        type: 'ASSET_SHARED',
        title: 'Asset shared with you',
        message: 'A fashion item has been shared with you.',
        read: true,
      },
      {
        recipient: client3Id,
        type: 'WORKFLOW_FAILED',
        title: 'Generation failed',
        message: 'Workflow failed: Insufficient credits.',
        read: false,
      },
      {
        recipient: artist1Id,
        type: 'COMMISSION_ASSIGNED',
        title: 'New commission assigned',
        message: 'You have been assigned a new commission.',
        read: false,
      },
      {
        recipient: artist1Id,
        type: 'WORKFLOW_COMPLETED',
        title: 'Workflow completed',
        message: 'Your generation workflow completed successfully.',
        read: true,
      },
      {
        recipient: artist1Id,
        type: 'WORKFLOW_FAILED',
        title: 'Workflow failed',
        message: 'Your workflow failed: Insufficient credits.',
        read: false,
      },
      {
        recipient: artist2Id,
        type: 'COMMISSION_ASSIGNED',
        title: 'New commission assigned',
        message: 'You have been assigned a commission.',
        read: false,
      },
      {
        recipient: artist2Id,
        type: 'COMMISSION_SUBMITTED',
        title: 'Work submitted',
        message: 'Your submitted work is under review.',
        read: true,
      },
      {
        recipient: artist2Id,
        type: 'ASSET_SHARED',
        title: 'Asset shared',
        message: 'An asset was shared with a client.',
        read: false,
      },
      {
        recipient: artist3Id,
        type: 'COMMISSION_ASSIGNED',
        title: 'New commission assigned',
        message: 'You have been assigned a commission.',
        read: false,
      },
      {
        recipient: artist3Id,
        type: 'WORKFLOW_COMPLETED',
        title: 'Workflow completed',
        message: 'Your generation workflow completed.',
        read: true,
      },
      {
        recipient: artist4Id,
        type: 'COMMISSION_CHANGES_REQUESTED',
        title: 'Changes requested',
        message: 'Client requested changes to your submission.',
        read: false,
      },
      {
        recipient: artist4Id,
        type: 'WORKFLOW_FAILED',
        title: 'Workflow failed',
        message: 'Workflow failed: Model timeout.',
        read: false,
      },
      {
        recipient: artist5Id,
        type: 'COMMISSION_ASSIGNED',
        title: 'New commission assigned',
        message: 'You have been assigned a commission.',
        read: false,
      },
      {
        recipient: artist5Id,
        type: 'WORKFLOW_COMPLETED',
        title: 'Workflow completed',
        message: 'Your generation workflow completed successfully.',
        read: true,
      },
      {
        recipient: adminId,
        type: 'COMMISSION_ASSIGNED',
        title: 'New commission created',
        message: 'A new commission was created.',
        read: false,
      },
      {
        recipient: adminId,
        type: 'WORKFLOW_COMPLETED',
        title: 'Workflow completed',
        message: 'A workflow has completed in the studio.',
        read: true,
      },
      {
        recipient: adminId,
        type: 'WORKFLOW_FAILED',
        title: 'Workflow failed',
        message: 'A workflow failed: Content policy violation.',
        read: false,
      },
      {
        recipient: adminId,
        type: 'ASSET_SHARED',
        title: 'Asset shared',
        message: 'An asset was shared with a client.',
        read: true,
      },
      {
        recipient: adminId,
        type: 'COMMISSION_SUBMITTED',
        title: 'Work submitted for review',
        message: 'Work submitted for a commission.',
        read: false,
      },
      {
        recipient: adminId,
        type: 'COMMISSION_APPROVED',
        title: 'Commission approved',
        message: 'A commission was approved.',
        read: true,
      },
      {
        recipient: adminId,
        type: 'COMMISSION_CHANGES_REQUESTED',
        title: 'Changes requested',
        message: 'Changes requested for a commission.',
        read: false,
      },
    ];
    for (const n of notifDefs) {
      await client.query(
        `INSERT INTO notifications (id, recipient_id, type, title, message, is_read, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
        [uid(), n.recipient, n.type, n.title, n.message, n.read],
      );
    }

    // -------------------------------------------------------------------
    // 16. MARKETPLACE LISTINGS (24 entries)
    // -------------------------------------------------------------------
    const listingDefs: Array<{
      assetId: string;
      sellerId: string;
      price: string;
      ltype: string;
      active: boolean;
      purchasedBy: string | null;
    }> = [
      {
        assetId: actorIds[0],
        sellerId: artist2Id,
        price: '10.00',
        ltype: 'ACTOR_PACKAGE',
        active: true,
        purchasedBy: null,
      },
      {
        assetId: actorIds[1],
        sellerId: artist1Id,
        price: '15.00',
        ltype: 'ACTOR_PACKAGE',
        active: true,
        purchasedBy: null,
      },
      {
        assetId: actorIds[2],
        sellerId: artist3Id,
        price: '12.50',
        ltype: 'ACTOR_PACKAGE',
        active: true,
        purchasedBy: null,
      },
      {
        assetId: actorIds[3],
        sellerId: artist4Id,
        price: '20.00',
        ltype: 'ACTOR_PACKAGE',
        active: true,
        purchasedBy: null,
      },
      {
        assetId: lookIds[0],
        sellerId: artist3Id,
        price: '8.00',
        ltype: 'LOOK',
        active: true,
        purchasedBy: null,
      },
      {
        assetId: lookIds[1],
        sellerId: artist2Id,
        price: '12.00',
        ltype: 'LOOK',
        active: true,
        purchasedBy: null,
      },
      {
        assetId: lookIds[2],
        sellerId: artist1Id,
        price: '6.50',
        ltype: 'LOOK',
        active: true,
        purchasedBy: null,
      },
      {
        assetId: lookIds[3],
        sellerId: artist5Id,
        price: '9.00',
        ltype: 'LOOK',
        active: true,
        purchasedBy: null,
      },
      {
        assetId: lookIds[4],
        sellerId: artist4Id,
        price: '11.00',
        ltype: 'LOOK',
        active: true,
        purchasedBy: null,
      },
      {
        assetId: lookIds[5],
        sellerId: artist3Id,
        price: '7.50',
        ltype: 'LOOK',
        active: true,
        purchasedBy: null,
      },
      {
        assetId: fiIds[0],
        sellerId: artist1Id,
        price: '20.00',
        ltype: 'FASHION_ITEM',
        active: true,
        purchasedBy: null,
      },
      {
        assetId: fiIds[1],
        sellerId: artist2Id,
        price: '15.00',
        ltype: 'FASHION_ITEM',
        active: true,
        purchasedBy: null,
      },
      {
        assetId: fiIds[2],
        sellerId: artist3Id,
        price: '18.00',
        ltype: 'FASHION_ITEM',
        active: true,
        purchasedBy: null,
      },
      {
        assetId: fiIds[3],
        sellerId: artist4Id,
        price: '22.00',
        ltype: 'FASHION_ITEM',
        active: true,
        purchasedBy: null,
      },
      {
        assetId: fiIds[4],
        sellerId: artist5Id,
        price: '14.00',
        ltype: 'FASHION_ITEM',
        active: true,
        purchasedBy: null,
      },
      {
        assetId: actorIds[10],
        sellerId: artist3Id,
        price: '5.00',
        ltype: 'ACTOR_PACKAGE',
        active: false,
        purchasedBy: client2Id,
      },
      {
        assetId: actorIds[11],
        sellerId: artist2Id,
        price: '8.00',
        ltype: 'ACTOR_PACKAGE',
        active: false,
        purchasedBy: client3Id,
      },
      {
        assetId: lookIds[10],
        sellerId: artist1Id,
        price: '7.50',
        ltype: 'LOOK',
        active: false,
        purchasedBy: client1Id,
      },
      {
        assetId: lookIds[11],
        sellerId: artist4Id,
        price: '9.00',
        ltype: 'LOOK',
        active: false,
        purchasedBy: client2Id,
      },
      {
        assetId: fiIds[10],
        sellerId: artist5Id,
        price: '12.00',
        ltype: 'FASHION_ITEM',
        active: false,
        purchasedBy: client1Id,
      },
      {
        assetId: fiIds[11],
        sellerId: artist3Id,
        price: '16.00',
        ltype: 'FASHION_ITEM',
        active: false,
        purchasedBy: client3Id,
      },
      {
        assetId: fiIds[12],
        sellerId: artist2Id,
        price: '18.00',
        ltype: 'FASHION_ITEM',
        active: false,
        purchasedBy: null,
      },
      {
        assetId: fiIds[13],
        sellerId: artist1Id,
        price: '25.00',
        ltype: 'FASHION_ITEM',
        active: false,
        purchasedBy: null,
      },
      {
        assetId: lookIds[12],
        sellerId: artist5Id,
        price: '10.00',
        ltype: 'LOOK',
        active: false,
        purchasedBy: null,
      },
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
    console.log(`Admin:      admin@cast.studio      / ${DEFAULT_PASSWORD}`);
    console.log(`API Artist: api-artist@cast.studio  / ${DEFAULT_PASSWORD} (API-enabled)`);
    console.log(`Jane:       jane@cast.studio        / ${DEFAULT_PASSWORD} (API-enabled)`);
    console.log(`Mika:       mika@cast.studio        / ${DEFAULT_PASSWORD}`);
    console.log(`Rio:        rio@cast.studio         / ${DEFAULT_PASSWORD}`);
    console.log(`Sage:       sage@cast.studio        / ${DEFAULT_PASSWORD}`);
    console.log(`Client A:   client@cast.studio      / ${DEFAULT_PASSWORD}`);
    console.log(`Client B:   client-b@cast.studio    / ${DEFAULT_PASSWORD}`);
    console.log(`Client C:   client-c@cast.studio    / ${DEFAULT_PASSWORD}`);
    console.log('\n=== Summary ===');
    console.log('Workspaces:          4 (1 studio, 3 client)');
    console.log('Accounts:            9 (1 admin, 5 artists, 3 clients)');
    console.log('API Keys:            3 (2 active, 1 revoked)');
    console.log('Wallets:             4');
    console.log('Ledger entries:      20+ (TOP_UP, CHARGE, ESCROW_HOLD, ESCROW_REFUND)');
    console.log('Actors:              25 (5 outputs each = 125 asset_outputs)');
    console.log('Looks:               25 (1 output each)');
    console.log('Fashion Items:       30 (1 output each)');
    console.log('Output Versions:     5 (3 for actor0 headshot, 2 for actor1 fullshot)');
    console.log('Permissions:         18 (14 active, 4 revoked)');
    console.log('Commissions:         24 (all 7 statuses represented)');
    console.log('Commission Assets:   18');
    console.log('Workflows:           10 (4 RUNNING, 3 COMPLETED, 3 FAILED)');
    console.log('Notifications:       33 (all spec types)');
    console.log('Models:              10 (7 active, 3 inactive)');
    console.log(
      'Taxonomy:            72 entries (20 actor props, 20 look, 20 fashion, 10 commission, 2 global)',
    );
    console.log('Marketplace:         24 listings (15 active, 6 purchased, 3 inactive)');
    console.log('\nAll marketplace statuses: APPROVED, PENDING, REJECTED, DELISTED, null');
    console.log('All source types: ORIGINAL, DUPLICATE, MARKETPLACE_PURCHASE, COMMISSION');
    console.log('All output statuses: SUCCESS, FAILED, PENDING');
    console.log('Obsolete outputs: Yes (with reason)');
    console.log('Assets with client_id: Yes (purchased assets)');
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
