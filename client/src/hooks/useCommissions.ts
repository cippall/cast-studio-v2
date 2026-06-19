/**
 * API hooks for commissions — list, detail, create, status transitions, assign, premium unlock.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type {
  Commission,
  CommissionFormTemplate,
  PaginatedResponse,
  PaginationParams,
  CommissionStatus,
} from '@cast/types';

interface CommissionFilters extends PaginationParams {
  status?: CommissionStatus | string;
}

function buildQueryString(filters: CommissionFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (filters.status) params.set('status', filters.status);
  return params.toString();
}

export function useCommissions(filters: CommissionFilters = {}) {
  return useQuery<PaginatedResponse<Commission>>({
    queryKey: ['commissions', filters],
    queryFn: async () => {
      const qs = buildQueryString(filters);
      const { data } = await apiClient.get(`/commissions?${qs}`);
      return data;
    },
  });
}

export function useCommission(id: string) {
  return useQuery<Commission>({
    queryKey: ['commissions', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/commissions/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateCommission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { title: string; brief: Record<string, unknown> }) => {
      const { data } = await apiClient.post('/commissions', input);
      return data as Commission;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    },
  });
}

export function useUpdateCommissionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: CommissionStatus | string;
      premiumCost?: number;
      assetIds?: string[];
    }) => {
      const { id, status, premiumCost, assetIds } = input;
      const body: Record<string, unknown> = { status };
      if (premiumCost !== undefined) body.premium_cost = premiumCost;
      if (assetIds !== undefined) body.asset_ids = assetIds;
      const { data } = await apiClient.patch(`/commissions/${id}/status`, body);
      return data as Commission;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['commissions', data.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useAssignCommission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; assigneeId: string }) => {
      const { data } = await apiClient.patch(`/commissions/${input.id}/assign`, {
        assignee_id: input.assigneeId,
      });
      return data as Commission;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      queryClient.invalidateQueries({ queryKey: ['commissions', data.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useCommissionFormTemplates() {
  return useQuery<CommissionFormTemplate[]>({
    queryKey: ['commission-forms'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/commission-forms');
      return data;
    },
  });
}
