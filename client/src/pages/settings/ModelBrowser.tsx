import { useMemo } from 'react';
import { useFalModels, useImportFalModel, type FalModel } from '@/hooks/useFalConfig';
import { useAdminModels } from '@/hooks/useAdminModels';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, Download } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_LABELS: Record<string, string> = {
  text_to_image: 'Text to Image',
  image_to_image: 'Image to Image',
  image_to_text: 'Image to Text',
};

const CATEGORY_ORDER: string[] = ['text_to_image', 'image_to_image', 'image_to_text'];

interface ModelBrowserProps {
  importingId: string | null;
  onImportModel: (model: FalModel) => Promise<void>;
}

export default function ModelBrowser({ importingId, onImportModel }: ModelBrowserProps) {
  const { data: models } = useAdminModels();
  const { data: falModels, isLoading: falLoading } = useFalModels();

  const importedIds = useMemo(() => new Set((models ?? []).map((m) => m.model_id)), [models]);

  const falModelsByCategory = useMemo(() => {
    const grouped: Record<string, FalModel[]> = {};
    for (const model of falModels ?? []) {
      const cat = model.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(model);
    }
    return grouped;
  }, [falModels]);

  if (falLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading models...</span>
      </div>
    );
  }

  if (!falModels?.length) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">No models found. Check your fal.ai API key.</p>
      </div>
    );
  }

  return (
    <>
      {CATEGORY_ORDER.filter((cat) => falModelsByCategory[cat]?.length).map((category) => (
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
                          onClick={() => onImportModel(model)}
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
      ))}
    </>
  );
}
