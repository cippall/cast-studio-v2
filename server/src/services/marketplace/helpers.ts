import { getAssetOutputs, getAssetOutputsBatch } from '../../db/repositories/asset-repo.js';
import type { AssetOutputRow } from '../../db/repositories/asset-repo.js';

// --- Constants ---

export const ACTOR_REQUIRED_OUTPUTS = [
  'headshot',
  'fullshot',
  'expressions_3x4',
  'character_sheet',
  'editorial',
];

// --- Types ---

export interface MarketplaceSubmission {
  asset_id: string;
  asset_name: string | null;
  asset_type: string;
  creator_id: string;
  creator_name: string;
  marketplace_status: string;
  submitted_at: string;
}

export interface AdminSubmissionDetail extends MarketplaceSubmission {
  outputs: Record<string, { status: string; image_url: string | null }>;
}

export interface MarketplaceListing {
  id: string;
  asset_id: string;
  seller_id: string;
  price_credits: number;
  listing_type: string;
  is_active: boolean;
  purchased_by: string | null;
  purchased_at: string | null;
  created_at: string;
}

export interface MarketplaceListingItem {
  id: string;
  listing_type: string;
  asset_id: string;
  asset: {
    id: string;
    name: string | null;
    headshot_url: string | null;
    fullshot_url: string | null;
  };
  seller_id: string;
  seller_name: string;
  price_credits: number;
  is_active: boolean;
  created_at: string;
}

export interface MarketplaceListingDetail {
  id: string;
  listing_type: string;
  asset: {
    id: string;
    name: string | null;
    headshot_url: string | null;
    fullshot_url: string | null;
    expression_sheet_url: string | null;
    character_sheet_url: string | null;
    editorial_urls: string[];
  };
  seller: { id: string; name: string };
  price_credits: number;
  is_active: boolean;
  created_at: string;
}

export interface PurchaseResult {
  listing_id: string;
  purchased_at: string;
  cost_credits: number;
  new_balance: number;
  assets: { layout_type: string; image_url: string | null }[];
}

export interface ManageableListing {
  id: string;
  asset_id: string;
  asset_name: string | null;
  asset_type: string;
  listing_type: string;
  price_credits: number;
  is_active: boolean;
  purchased_by: string | null;
  purchased_at: string | null;
  created_at: string;
}

export interface MarketplaceSettings {
  actor_package: {
    required_outputs: string[];
    generic_standard_look_id: string | null;
    editorial_count: number;
  };
  look_package: {
    required_outputs: string[];
  };
  fashion_item_package: {
    required_outputs: string[];
  };
}

// --- Helper functions ---

export function getActorOutputsForMarketplace(
  outputs: AssetOutputRow[],
): Record<string, { status: string; image_url: string | null }> {
  const result: Record<string, { status: string; image_url: string | null }> = {};
  for (const layout of ACTOR_REQUIRED_OUTPUTS) {
    const found = outputs.find((o) => o.layout_type === layout);
    result[layout] = found
      ? { status: found.status, image_url: found.image_url }
      : { status: 'MISSING', image_url: null };
  }
  return result;
}

export function getRequiredOutputsForType(assetType: string): string[] {
  if (assetType === 'ACTOR') return ACTOR_REQUIRED_OUTPUTS;
  if (assetType === 'LOOK') return ['look_image'];
  if (assetType === 'FASHION_ITEM') return ['item_image'];
  return [];
}

export function findMissingOutputs(outputs: AssetOutputRow[], requiredLayouts: string[]): string[] {
  return requiredLayouts.filter((layout) => {
    const output = outputs.find((o) => o.layout_type === layout);
    return !output || output.status !== 'SUCCESS';
  });
}

export const LISTING_LIST_COLS = `
  ml.id, ml.listing_type, ml.asset_id, ml.seller_id, ml.price_credits, ml.is_active, ml.created_at,
  a.name AS asset_name,
  ah.image_url AS headshot_url,
  af.image_url AS fullshot_url,
  s.name AS seller_name
`;

export function buildListingJoins(): string {
  return `
    LEFT JOIN LATERAL (
      SELECT image_url FROM asset_outputs
      WHERE asset_id = a.id AND layout_type = 'headshot' AND status = 'SUCCESS' AND is_obsolete = FALSE
      LIMIT 1
    ) ah ON true
    LEFT JOIN LATERAL (
      SELECT image_url FROM asset_outputs
      WHERE asset_id = a.id AND layout_type = 'fullshot' AND status = 'SUCCESS' AND is_obsolete = FALSE
      LIMIT 1
    ) af ON true
    JOIN accounts s ON s.id = ml.seller_id
  `;
}

export function parseListingRow(row: Record<string, unknown>): MarketplaceListingItem {
  return {
    id: String(row.id),
    listing_type: String(row.listing_type),
    asset_id: String(row.asset_id),
    asset: {
      id: String(row.asset_id),
      name: row.asset_name ? String(row.asset_name) : null,
      headshot_url: row.headshot_url ? String(row.headshot_url) : null,
      fullshot_url: row.fullshot_url ? String(row.fullshot_url) : null,
    },
    seller_id: String(row.seller_id),
    seller_name: String(row.seller_name),
    price_credits: Number(Number.parseFloat(String(row.price_credits)).toFixed(4)),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}
