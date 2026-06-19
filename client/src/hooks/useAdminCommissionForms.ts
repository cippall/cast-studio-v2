/**
 * Admin commission form hooks — CRUD for commission form templates.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface CommissionFormTemplate {
  id: string;
  name: string;
  fields: Array<{
    key: string;
    label: string;
    input_type: string;
    is_required: boolean;
    options?: Array<{ value: string; label: string }>;
  }>;
  is_active: boolean;
}

export function useAdminCommissionForms() {
  return useQuery<CommissionFormTemplate[]>({
    queryKey: ['admin', 'commission-forms'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/commission-forms');
      return data;
    },
  });
}

export function useCreateCommissionForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CommissionFormTemplate, 'id'>) => {
      const { data } = await apiClient.post('/admin/commission-forms', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'commission-forms'] });
    },
  });
}

export function useUpdateCommissionForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<CommissionFormTemplate> & { id: string }) => {
      const { data } = await apiClient.patch(`/admin/commission-forms/${input.id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'commission-forms'] });
    },
  });
}

export function useDeleteCommissionForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/commission-forms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'commission-forms'] });
    },
  });
}
