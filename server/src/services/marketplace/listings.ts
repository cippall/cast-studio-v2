import { query } from '../../db/pool.js';
import { getAssetOutputs } from '../../db/repositories/asset-repo.js';
import {
  LISTING_LIST_COLS,
  buildListingJoins,
  parseListingRow,
  type MarketplaceListingItem,
  type MarketplaceListingDetail,
} from './helpers.js';

export async function listMarketplaceListings(
  options: {
    listingType?: string;
    maxPrice?: number;
    creatorId?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: string;
  } = {},
): Promise<{
  data: MarketplaceListingItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}> {
  const {
    listingType,
    maxPrice,
    creatorId,
    page = 1,
    pageSize = 20,
    sortBy = 'created_at',
    sortOrder = 'desc',
  } = options;

  const params: unknown[] = [];
  const conditions: string[] = ['ml.is_active = TRUE', 'ml.purchased_by IS NULL'];
  let idx = 1;

  if (listingType) {
    conditions.push(`ml.listing_type = $${idx++}`);
    params.push(listingType);
  }

  if (maxPrice !== undefined) {
    conditions.push(`ml.price_credits <= $${idx++}`);
    params.push(maxPrice);
  }

  if (creatorId) {
    conditions.push(`ml.seller_id = $${idx++}`);
    params.push(creatorId);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;
  const joins = buildListingJoins();
  const safeSortBy = sortBy.replace(/[^a-zA-Z0-9_.]/g, '');
  const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countSql = `SELECT COUNT(*)::int AS count FROM marketplace_listings ml ${whereClause}`;
  const countResult = await query(countSql, params);
  const countRow = countResult.rows[0] as { count: number } | undefined;
  const totalItems = typeof countRow?.count === 'number' ? countRow.count : 0;

  const offset = (page - 1) * pageSize;
  const dataSql = `
    SELECT ${LISTING_LIST_COLS}
    FROM marketplace_listings ml
    JOIN assets a ON a.id = ml.asset_id AND a.is_marketplace_frozen = TRUE
    ${joins}
    ${whereClause}
    ORDER BY ml.${safeSortBy} ${safeSortOrder}
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const dataResult = await query(dataSql, [...params, pageSize, offset]);
  const data = (dataResult.rows as Record<string, unknown>[]).map(parseListingRow);

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0,
    },
  };
}

export async function getMarketplaceListing(
  listingId: string,
): Promise<MarketplaceListingDetail | null> {
  const listingSql = `
    SELECT ml.id, ml.listing_type, ml.asset_id, ml.seller_id, ml.price_credits, ml.is_active, ml.created_at,
           a.name AS asset_name, a.asset_type,
           s.name AS seller_name
    FROM marketplace_listings ml
    JOIN assets a ON a.id = ml.asset_id
    JOIN accounts s ON s.id = ml.seller_id
    WHERE ml.id = $1 AND ml.is_active = TRUE AND ml.purchased_by IS NULL
  `;
  const listingResult = await query(listingSql, [listingId]);

  if (listingResult.rows.length === 0) return null;

  const listing = listingResult.rows[0] as Record<string, unknown>;

  // Fetch all successful outputs for the asset
  const outputs = await getAssetOutputs(String(listing.asset_id));

  const pickUrl = (layoutType: string): string | null => {
    const match = outputs.find((o) => o.layout_type === layoutType && o.status === 'SUCCESS');
    return match?.image_url ?? null;
  };

  const editorialUrls = outputs
    .filter((o) => o.layout_type === 'editorial' && o.status === 'SUCCESS')
    .map((o) => o.image_url)
    .filter((u): u is string => u !== null);

  return {
    id: String(listing.id),
    listing_type: String(listing.listing_type),
    asset: {
      id: String(listing.asset_id),
      name: listing.asset_name ? String(listing.asset_name) : null,
      headshot_url: pickUrl('headshot'),
      fullshot_url: pickUrl('fullshot'),
      expression_sheet_url: pickUrl('expressions_3x4'),
      character_sheet_url: pickUrl('character_sheet'),
      editorial_urls: editorialUrls,
    },
    seller: {
      id: String(listing.seller_id),
      name: String(listing.seller_name),
    },
    price_credits: Number(Number.parseFloat(String(listing.price_credits)).toFixed(4)),
    is_active: Boolean(listing.is_active),
    created_at: String(listing.created_at),
  };
}
