/**
 * ModelsPage — fal.ai connection, model browser, and admin model management.
 */
import { useState } from 'react';
import {
  useFalKeyStatus,
  useDisconnectFalKey,
  useImportFalModel,
  type FalModel,
} from '@/hooks/useFalConfig';
import { useAdminModels } from '@/hooks/useAdminModels';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import FalConnectionFlow from './FalConnectionFlow';
import ModelBrowser from './ModelBrowser';
import ConfiguredModels from './ConfiguredModels';

export default function ModelsPage() {
  const { data: falStatus } = useFalKeyStatus();
  const disconnectFalKey = useDisconnectFalKey();
  const importModel = useImportFalModel();
  const { data: models, isLoading, isError, error } = useAdminModels();

  const [importingId, setImportingId] = useState<string | null>(null);

  const isConnected = falStatus?.connected ?? false;

  const extractDefaultParams = (
    schema: Record<
      string,
      { title: string; type: string; description?: string; default?: unknown }
    >,
  ): Record<string, unknown> => {
    const defaults: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(schema)) {
      if (prop.default !== undefined) {
        defaults[key] = prop.default;
      }
    }
    return defaults;
  };

  const handleImportModel = async (model: FalModel) => {
    setImportingId(model.id);
    try {
      const inputSchema = model.inputSchema ?? {};
      await importModel.mutateAsync({
        fal_model_id: model.id,
        name: model.name,
        description: model.description,
        category: model.category,
        input_schema: inputSchema,
        default_parameters: extractDefaultParams(
          inputSchema as Record<
            string,
            { title: string; type: string; description?: string; default?: unknown }
          >,
        ),
      });
      toast.success(`Imported ${model.name}`);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? 'Failed to import model');
    } finally {
      setImportingId(null);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectFalKey.mutateAsync();
      toast.success('fal.ai disconnected');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message ?? 'Failed to disconnect');
    }
  };

  if (!isConnected) {
    return (
      <PageContainer>
        <div className="flex flex-col gap-6">
          <PageHeader title="Models" description="Configure AI models for generation tasks" />
          <FalConnectionFlow />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Models"
          description="Browse fal.ai models and configure active models for each task"
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-success">
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

          <TabsContent value="browse" className="space-y-6">
            <ModelBrowser importingId={importingId} onImportModel={handleImportModel} />
          </TabsContent>

          <TabsContent value="configured">
            <ConfiguredModels
              models={models}
              isLoading={isLoading}
              isError={isError}
              error={error}
            />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
