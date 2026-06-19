/**
 * ModelsPage — fal.ai connection, model browser, and admin model management.
 * Wrapped in PageContainer for responsive padding.
 */
import { useState, useMemo } from 'react';
import {
  useAdminModels,
  useDeleteModel,
  useUpdateModel,
  useFalKeyStatus,
  useSaveFalKey,
  useTestFalKey,
  useDisconnectFalKey,
  useFalModels,
  useImportFalModel,
  useModelSchema,
  useSaveModelParameters,
  type ModelConfig,
  type FalModel,
} from '@/hooks/useAdmin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/DataTable';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import ModelParameterForm from '@/components/ModelParameterForm';
import {
  Loader2,
  Plus,
  Plug,
  CheckCircle2,
  XCircle,
  Download,
  ExternalLink,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_LABELS: Record<string, string> = {
  text_to_image: 'Text to Image',
  image_to_image: 'Image to Image',
  image_to_text: 'Image to Text',
};

const CATEGORY_ORDER: string[] = ['text_to_image', 'image_to_image', 'image_to_text'];

export default function ModelsPage() {
  const { data: models, isLoading, isError, error } = useAdminModels();
  const updateModel = useUpdateModel();
  const deleteModel = useDeleteModel();
  const { data: falStatus } = useFalKeyStatus();
  const saveFalKey = useSaveFalKey();
  const testFalKey = useTestFalKey();
  const disconnectFalKey = useDisconnectFalKey();
  const { data: falModels, isLoading: falLoading } = useFalModels();
  const importModel = useImportFalModel();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [configuringModel, setConfiguringModel] = useState<ModelConfig | null>(null);

  const isConnected = falStatus?.connected ?? false;

  // Fetch schema for the model being configured
  const { data: modelSchema, isLoading: schemaLoading } = useModelSchema(
    configuringModel?.id ?? null,
  );
  const saveParameters = useSaveModelParameters();

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

  const handleConfigureSave = async (parameters: Record<string, unknown>) => {
    if (!configuringModel) return;
    try {
      await saveParameters.mutateAsync({ id: configuringModel.id, parameters });
      toast.success('Parameters saved');
      setConfiguringModel(null);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to save parameters');
    }
  };

  const handleImportModel = async (model: FalModel) => {
    setImportingId(model.id);
    try {
      await importModel.mutateAsync({
        fal_model_id: model.id,
        name: model.name,
        description: model.description,
        category: model.category,
        parameters: model.inputSchema ?? {},
      });
      toast.success(`Imported ${model.name}`);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to import model');
    } finally {
      setImportingId(null);
    }
  };

  // Determine which fal.ai models are already imported
  const importedIds = useMemo(() => new Set((models ?? []).map((m) => m.model_id)), [models]);

  // Group fal.ai models by category
  const falModelsByCategory = useMemo(() => {
    const grouped: Record<string, FalModel[]> = {};
    for (const model of falModels ?? []) {
      const cat = model.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(model);
    }
    return grouped;
  }, [falModels]);

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

  // --- Connected: show model browser + management ---
  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Models"
          description="Browse fal.ai models and configure active models for each task"
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="size-4" /> fal.ai connected
            </span>
            <Button variant="outline" size="sm" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        </PageHeader>

        <Tabs defaultValue="browse" className="w-full">
          <TabsList>
            <TabsTrigger value="browse">Model Browser</TabsTrigger>
            <TabsTrigger value="configured">Configured Models</TabsTrigger>
          </TabsList>

          {/* --- Model Browser Tab --- */}
          <TabsContent value="browse" className="space-y-6">
            {falLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading models...</span>
              </div>
            ) : !falModels?.length ? (
              <div className="flex items-center justify-center py-20">
                <p className="text-sm text-muted-foreground">
                  No models found. Check your fal.ai API key.
                </p>
              </div>
            ) : (
              CATEGORY_ORDER.filter((cat) => falModelsByCategory[cat]?.length).map((category) => (
                <div key={category} className="space-y-4">
                  <h3 className="font-heading text-lg font-semibold text-foreground">
                    {CATEGORY_LABELS[category] ?? category}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {falModelsByCategory[category]?.map((model) => {
                      const isImported = importedIds.has(model.id);
                      const isImporting = importingId === model.id;

                      return (
                        <Card key={model.id} className="flex flex-col">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-base font-heading">{model.name}</CardTitle>
                              {isImported && (
                                <Badge variant="secondary" className="shrink-0">
                                  <CheckCircle2 className="mr-1 size-3" /> Added
                                </Badge>
                              )}
                            </div>
                            {model.description && (
                              <CardDescription className="text-xs mt-1">
                                {model.description}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent className="flex-1 flex flex-col gap-3 pt-0">
                            {/* Supported features from input schema */}
                            {model.inputSchema && Object.keys(model.inputSchema).length > 0 && (
                              <div className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Supported inputs:
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(model.inputSchema)
                                    .slice(0, 6)
                                    .map(([key, schema]) => (
                                      <Badge key={key} variant="outline" className="text-xs">
                                        {schema.title ?? key}
                                      </Badge>
                                    ))}
                                  {Object.keys(model.inputSchema).length > 6 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{Object.keys(model.inputSchema).length - 6} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Model endpoint */}
                            <div className="text-xs text-muted-foreground truncate">
                              <span className="font-medium">Endpoint:</span>{' '}
                              <span className="font-mono">{model.id}</span>
                            </div>

                            <div className="mt-auto pt-2">
                              {isImported ? (
                                <Button variant="outline" size="sm" className="w-full" disabled>
                                  <CheckCircle2 className="mr-2 size-4 text-green-600" />
                                  Already added
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={() => handleImportModel(model)}
                                  disabled={isImporting}
                                >
                                  {isImporting ? (
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                  ) : (
                                    <Download className="mr-2 size-4" />
                                  )}
                                  Import model
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* --- Configured Models Tab --- */}
          <TabsContent value="configured">
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
          </TabsContent>
        </Tabs>

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

        {/* Configure Parameters dialog */}
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
      </div>
    </PageContainer>
  );
}
