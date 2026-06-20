import { useState } from 'react';
import {
  useAdminModels,
  useDeleteModel,
  useUpdateModel,
  useModelSchema,
  useSaveModelParameters,
  useAssignModelTask,
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
import { Label } from '@/components/ui/label';
import { Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import ModelParameterForm from '@/components/ModelParameterForm';

const TASK_OPTIONS = [
  { value: 'actor_headshot', label: 'Actor Headshot' },
  { value: 'actor_fullshot', label: 'Actor Fullshot' },
  { value: 'actor_expressions', label: 'Actor Expressions' },
  { value: 'actor_editorial', label: 'Actor Editorial' },
  { value: 'actor_character_sheet', label: 'Actor Character Sheet' },
  { value: 'look_generation', label: 'Look Generation' },
  { value: 'fashion_item', label: 'Fashion Item' },
  { value: 'character_sheet_composition', label: 'Character Sheet Composition' },
  { value: 'reference_extraction', label: 'Reference Extraction' },
];

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
  const assignTask = useAssignModelTask();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [configuringModel, setConfiguringModel] = useState<ModelConfig | null>(null);
  const [assigningModel, setAssigningModel] = useState<ModelConfig | null>(null);
  const [selectedTask, setSelectedTask] = useState('');

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

  const handleAssignTask = async () => {
    if (!assigningModel || !selectedTask) return;
    try {
      await assignTask.mutateAsync({ id: assigningModel.id, task: selectedTask });
      toast.success(`${assigningModel.name} assigned to ${selectedTask}`);
      setAssigningModel(null);
      setSelectedTask('');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? 'Failed to assign task');
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
            key="assign"
            className="flex w-full cursor-pointer items-center px-2 py-1.5 text-sm"
            onClick={() => {
              setAssigningModel(row);
              setSelectedTask(row.task ?? '');
            }}
          >
            <Settings2 className="mr-2 size-4" />
            Assign to task
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

      {/* Assign task dialog */}
      <Dialog open={!!assigningModel} onOpenChange={() => setAssigningModel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Model to Task</DialogTitle>
            {assigningModel && (
              <p className="text-sm text-muted-foreground">
                {assigningModel.name} ({assigningModel.model_id})
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-select">Task</Label>
              <select
                id="task-select"
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Not assigned —</option>
                {TASK_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                The assigned model will be used by default for this generation task.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningModel(null)}>
              Cancel
            </Button>
            <Button onClick={handleAssignTask} disabled={assignTask.isPending || !selectedTask}>
              {assignTask.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
