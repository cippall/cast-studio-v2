import { useState } from 'react';
import { useSaveFalKey, useTestFalKey } from '@/hooks/useFalConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plug, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface FalConnectionFlowProps {
  onConnected?: () => void;
}

export default function FalConnectionFlow({ onConnected }: FalConnectionFlowProps) {
  const saveFalKey = useSaveFalKey();
  const testFalKey = useTestFalKey();

  const [showConnect, setShowConnect] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

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
      onConnected?.();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to save API key');
    }
  };

  return (
    <div className="rounded-lg border border-border p-6">
      <div className="flex items-center gap-3 mb-4">
        <Plug className="size-5 text-primary" />
        <div>
          <h3 className="font-heading text-base font-semibold text-foreground">Connect fal.ai</h3>
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
  );
}
