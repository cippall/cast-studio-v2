/**
 * Fashion Item Detail — full item view with image, name, taxonomy values, and actions.
 *
 * Delegates to shared SingleAssetDetail component.
 */
import apiClient from '@/lib/api-client';
import type { MarketplaceStatus } from '@cast/types';
import SingleAssetDetail, {
  type SingleAssetDetailConfig,
} from '@/components/layout/SingleAssetDetail';

interface FashionItemOutput {
  id: string;
  image_url: string | null;
  model: string;
  status: string;
  cost_credits: number;
  error_message?: string | null;
}

interface FashionItemDetail {
  id: string;
  name: string;
  asset_type: string;
  image_url: string | null;
  outputs: FashionItemOutput[];
  taxonomy_values: Record<string, string>;
  marketplace_status?: string | null;
  is_marketplace_frozen?: boolean;
  source_type?: string;
  created_at: string;
}

const fashionItemConfig: SingleAssetDetailConfig<FashionItemDetail> = {
  queryKey: (id) => ['fashion-items', id],
  fetchById: async (id) => {
    const { data } = await apiClient.get(`/fashion-items/${id}`);
    return data;
  },
  regenerate: async (id) => {
    const { data } = await apiClient.post(`/fashion-items/${id}/regenerate`, {});
    return data;
  },
  duplicate: async (id, name) => {
    const { data } = await apiClient.post(`/assets/${id}/duplicate`, { name });
    return data;
  },
  remove: async (id) => {
    await apiClient.delete(`/fashion-items/${id}`);
  },
  submitToMarketplace: async (assetId) => {
    const { data } = await apiClient.post('/marketplace/submit', { asset_id: assetId });
    return data;
  },
  libraryLabel: 'Fashion Items',
  libraryPath: '/fashion-items',
  typeLabel: 'Fashion Item',
  assetName: (detail) => detail.name,
  assetOutputs: (detail) => detail.outputs,
  assetTaxonomy: (detail) => detail.taxonomy_values,
  isFrozen: (detail) => detail.is_marketplace_frozen === true,
  marketplaceStatus: (detail) => (detail.marketplace_status as MarketplaceStatus | null) ?? null,
  sourceType: (detail) => detail.source_type,
  notFoundMessage: 'Fashion item not found.',
  backPath: '/fashion-items',
  backLabel: 'Back to Items',
};

export default function FashionItemDetailPage() {
  return <SingleAssetDetail config={fashionItemConfig} />;
}
