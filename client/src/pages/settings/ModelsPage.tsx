/**
 * ModelsPage — fal.ai connection + admin model management table.
 * Wrapped in PageContainer for responsive padding.
 */
import { useState } from 'react';
import {
  useAdminModels,
  useDeleteModel,
  useUpdateModel,
  useFalKeyStatus,
  useSaveFalKey,
  useTestFalKey,
  useDisconnectFalKey,
  type ModelConfig,
} from '@/hooks/useAdmin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Plus, Plug, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ModelsPage() {
  const { data: models, isLoading, isError, error } = useAdminModels();
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();
  const { data: falStatus } = useFalKeyStatus();
  const saveFalKey = useSaveFalKey();
  const testFalKey = useTestFalKey();
  const disconnectFalKey = useDisconnectFalKey();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const isConnected = falStatus?.connected ?? false;

  const handleTestConnection = async () => {
    if (!apiKeyInput.trim()) {
      toast.error('Please enter an API key');
      return;
    }
    setTestResult(null);
    try {
      await testFalKey.mutateAsync(apiKeyInput.trim());
      setTestResult('success');
    } catch {
      setTestResult('error');
    }
  };

  const handleSaveKey = async () => {
    if (!apiKeyInput.trim()) {
      toast.error('Please enter an API key');
      return;
    }
    try {
      await saveFalKey.mutateAsync(apiKeyInput.trim());
      toast.success('fal.ai API key saved');
      setApiKeyInput('');
      setShowConnect(false);
      setTestResult(null);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to save API key');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectFalKey.mutateAsync();
      toast.success('fal.ai disconnected');
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to disconnect');
    }
  };

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

  // --- Not connected: show connect section ---
  if (!isConnected) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-6">
          <PageHeader title="Models" description="Configure AI models for generation tasks" />

          {/* Connect fal.ai section */}
          <div className="rounded-lg border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <Plug className="size-5 text-primary" />
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground">
                  Connect fal.ai
                </h3>
                <p className="text-sm text-muted-foreground">
                  Paste your fal.ai API key to enable AI-powered generation.
                </p>
              </div>
            </div>

            {!showConnect ? (
              <Button onClick={() => setShowConnect(true)}>
                <Plug className="mr-2 size-4" />
                Connect fal.ai
              </Button>
            ) : (
              <div className="space-y-4 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="fal-api-key">API Key</Label>
                  <Input
                    id="fal-api-key"
                    type="password"
                    placeholder="fal-ai_..."
                    value={apiKeyInput}
                    onChange={(e) => {
                      setApiKeyInput(e.target.value);
                      setTestResult(null);
                    }}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Your key is encrypted at rest and never exposed after saving.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleTestConnection}
                    disabled={testFalKey.isPending || !apiKeyInput.trim()}
                    variant="outline"
                    size="sm"
                  >
                    {testFalKey.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      'Test Connection'
                    )}
                  </Button>

                  {testResult === 'success' && (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <CheckCircle2 className="size-4" /> Connected
                    </span>
                  )}
                  {testResult === 'error' && (
                    <span className="flex items-center gap-1 text-sm text-destructive">
                      <XCircle className="size-4" /> Invalid key
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSaveKey}
                    disabled={saveFalKey.isPending || !apiKeyInput.trim()}
                    size="sm"
                  >
                    {saveFalKey.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      'Save & Connect'
                    )}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowConnect(false);
                      setApiKeyInput('');
                      setTestResult(null);
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </PageContainer>
    );
  }

  // --- Connected: show model management ---
  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader title="Models" description="Configure AI models for generation tasks">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="size-4" /> fal.ai connected
            </span>
            <Button variant="outline" size="sm" onClick={handleDisconnect}>
              Disconnect
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className="inline-flex">
                    <Button disabled>
                      <Plus className="mr-2 size-4" />
                      Add Model
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Coming Soon</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
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
