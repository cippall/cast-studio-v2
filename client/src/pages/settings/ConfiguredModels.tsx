import { useState } from 'react';
import {
  useAdminModels,
  useDeleteModel,
  useUpdateModel,
  useModelSchema,
  useSaveModelParameters,
  type ModelConfig,
} from '@/hooks/useAdminModels';
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
import { Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import ModelParameterForm from '@/components/ModelParameterForm';

interface ConfiguredModelsProps {
  models: ModelConfig[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

export default function ConfiguredModels({
  models,
  isLoading,
  isError,
  error,
}: ConfiguredModelsProps) {
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();
  const saveParameters = useSaveModelParameters();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [configuringModel, setConfiguringModel] = useState<ModelConfig | null>(null);

  const { data: modelSchema, isLoading: schemaLoading } = useModelSchema(
    configuringModel?.id ?? null,
  );

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateModel.mutateAsync({ id, is_active: !currentActive });
      toast.success(currentActive ? 'Model deactivated' : 'Model activated');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? 'Failed to update model');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteModel.mutateAsync(deleteId);
      toast.success('Model deleted');
      setDeleteId(null);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? 'Failed to delete model');
    }
  };

  const handleConfigureSave = async (parameters: Record<string, unknown>) => {
    if (!configuringModel) return;
    try {
      await saveParameters.mutateAsync({ id: configuringModel.id, parameters });
      toast.success('Parameters saved');
      setConfiguringModel(null);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? 'Failed to save parameters');
    }
  };

  const modelList = models ?? [];

  const columns: Column<ModelConfig>[] = [
    { key: 'name', header: 'Name', sortable: true, render: (row) => row.name },
    {
      key: 'model_id',
      header: 'Model ID',
      sortable: true,
      render: (row) => <span className="text-sm text-muted-foreground">{row.model_id}</span>,
    },
    { key: 'task', header: 'Task', sortable: true, render: (row) => row.task },
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
    <>
      <DataTable<ModelConfig>
        columns={columns}
        data={modelList}
        isLoading={isLoading}
        isError={isError}
        error={error instanceof Error ? error : null}
        emptyTitle="No configured models"
        emptyDescription="Import models from the Browser tab to get started."
        cardTitleKey="name"
        rowActions={(row) => [
          <button
            key="configure"
            className="flex w-full cursor-pointer items-center px-2 py-1.5 text-sm"
            onClick={() => setConfiguringModel(row)}
          >
            <Settings2 className="mr-2 size-4" />
            Configure
          </button>,
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

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-lg">
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
              {deleteModel.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!configuringModel} onOpenChange={() => setConfiguringModel(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure Parameters</DialogTitle>
            {configuringModel && (
              <p className="text-sm text-muted-foreground">
                {configuringModel.name} ({configuringModel.model_id})
              </p>
            )}
          </DialogHeader>
          <ModelParameterForm
            schema={modelSchema}
            isLoading={schemaLoading}
            initialValues={(configuringModel?.parameters as Record<string, unknown>) ?? {}}
            onSave={handleConfigureSave}
            isSaving={saveParameters.isPending}
            onCancel={() => setConfiguringModel(null)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
