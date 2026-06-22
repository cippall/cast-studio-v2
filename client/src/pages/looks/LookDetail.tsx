/**
 * Look Detail — full look view with image, name, taxonomy values, and actions.
 *
 * Delegates to shared SingleAssetDetail component.
 */
import apiClient from '@/lib/api-client';
import type { MarketplaceStatus } from '@cast/types';
import SingleAssetDetail, {
  type SingleAssetDetailConfig,
} from '@/components/layout/SingleAssetDetail';

interface LookOutput {
  id: string;
  image_url: string | null;
  model: string;
  status: string;
  cost_credits: number;
  error_message?: string | null;
}

interface LookDetail {
  id: string;
  name: string;
  asset_type: string;
  image_url: string | null;
  outputs: LookOutput[];
  taxonomy_values: Record<string, string>;
  marketplace_status?: string | null;
  is_marketplace_frozen?: boolean;
  source_type?: string;
  created_at: string;
}

const lookConfig: SingleAssetDetailConfig<LookDetail> = {
  queryKey: (id) => ['looks', id],
  fetchById: async (id) => {
    const { data } = await apiClient.get(`/looks/${id}`);
    return data;
  },
  regenerate: async (id) => {
    const { data } = await apiClient.post(`/looks/${id}/regenerate`, {});
    return data;
  },
  duplicate: async (id, name) => {
    const { data } = await apiClient.post(`/assets/${id}/duplicate`, { name });
    return data;
  },
  remove: async (id) => {
    await apiClient.delete(`/looks/${id}`);
  },
  submitToMarketplace: async (assetId) => {
    const { data } = await apiClient.post('/marketplace/submit', { asset_id: assetId });
    return data;
  },
  libraryLabel: 'Looks',
  libraryPath: '/looks',
  typeLabel: 'Look',
  assetName: (detail) => detail.name,
  assetOutputs: (detail) => detail.outputs,
  assetTaxonomy: (detail) => detail.taxonomy_values,
  isFrozen: (detail) => detail.is_marketplace_frozen === true,
  marketplaceStatus: (detail) => (detail.marketplace_status as MarketplaceStatus | null) ?? null,
  sourceType: (detail) => detail.source_type,
  notFoundMessage: 'Look not found.',
  backPath: '/looks',
  backLabel: 'Back to Looks',
};

export default function LookDetailPage() {
  return <SingleAssetDetail config={lookConfig} />;
}
