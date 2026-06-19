/**
 * ModelsPage — admin model management table using DataTable.
 * Wrapped in PageContainer for responsive padding.
 */
import { useState } from 'react';
import { useAdminModels, useDeleteModel, useUpdateModel, type ModelConfig } from '@/hooks/useAdmin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/DataTable';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function ModelsPage() {
  const { data: models, isLoading, isError, error } = useAdminModels();
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateModel.mutateAsync({ id, is_active: !currentActive });
      toast.success(currentActive ? 'Model deactivated' : 'Model activated');
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to update model');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteModel.mutateAsync(deleteId);
      toast.success('Model deleted');
      setDeleteId(null);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to delete model');
    }
  };

  const modelList = models ?? [];

  const columns: Column<ModelConfig>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (row) => row.name,
    },
    {
      key: 'model_id',
      header: 'Model ID',
      sortable: true,
      render: (row) => <span className="text-sm text-muted-foreground">{row.model_id}</span>,
    },
    {
      key: 'task',
      header: 'Task',
      sortable: true,
      render: (row) => row.task,
    },
    {
      key: 'is_active',
      header: 'Active',
      sortable: true,
      sortValue: (row) => (row.is_active ? 1 : 0),
      render: (row) => (
        <Badge variant={row.is_active ? 'default' : 'outline'}>
          {row.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader title="Models" description="Configure AI models for generation tasks">
          <Button disabled>
            <Plus className="mr-2 size-4" />
            Add Model
          </Button>
        </PageHeader>

        <DataTable<ModelConfig>
          columns={columns}
          data={modelList}
          isLoading={isLoading}
          isError={isError}
          error={error instanceof Error ? error : null}
          emptyTitle="No models"
          emptyDescription="No AI models configured yet."
          cardTitleKey="name"
          rowActions={(row) => [
            <button
              key="toggle"
              className="flex w-full cursor-pointer items-center px-2 py-1.5 text-sm"
              onClick={() => handleToggleActive(row.id, row.is_active)}
            >
              {row.is_active ? 'Deactivate' : 'Activate'}
            </button>,
            <button
              key="delete"
              className="flex w-full cursor-pointer items-center px-2 py-1.5 text-sm text-destructive"
              onClick={() => setDeleteId(row.id)}
            >
              Delete
            </button>,
          ]}
        />

        {/* Delete confirmation */}
        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Model</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this model? This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteModel.isPending}>
                {deleteModel.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  'Delete'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
