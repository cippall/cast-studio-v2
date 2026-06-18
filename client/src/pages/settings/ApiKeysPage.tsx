/**
 * ApiKeysPage — list, create, and revoke API keys.
 * Shows key value once on creation with copy button.
 * Revoke requires confirmation dialog.
 */
import { useState, useCallback } from 'react';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/useApiKeys';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Loader2, Plus, Copy, Check } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { toast } from 'sonner';
import type { ApiKey } from '@/hooks/useApiKeys';

export default function ApiKeysPage() {
  const { data, isLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const keys = data?.data ?? [];

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a key name');
      return;
    }
    try {
      const result = await createKey.mutateAsync({ name: newKeyName.trim() });
      setCreatedKey(result.key);
      setNewKeyName('');
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to create API key');
    }
  };

  const handleCopy = useCallback(async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.getElementById('created-key-input') as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, [createdKey]);

  const handleRevoke = async () => {
    if (!revokeId) return;
    try {
      await revokeKey.mutateAsync(revokeId);
      toast.success('API key revoked');
      setRevokeId(null);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to revoke API key');
    }
  };

  const handleCloseCreatedDialog = () => {
    setShowCreate(false);
    setCreatedKey(null);
    setNewKeyName('');
  };

  const columns: Column<ApiKey>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: 'key',
      header: 'Key',
      render: (row) => <span className="font-mono text-sm text-muted-foreground">{row.key}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.is_active ? 'default' : 'outline'}>
          {row.is_active ? 'Active' : 'Revoked'}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const rowActions = (row: ApiKey): React.ReactNode[] => [
    <button
      key="revoke"
      type="button"
      className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-destructive"
      onClick={() => setRevokeId(row.id)}
      disabled={!row.is_active}
    >
      <Trash2 className="size-4" />
      Revoke
    </button>,
  ];

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader title="API Keys" description="Manage API keys for programmatic access">
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 size-4" />
            New Key
          </Button>
        </PageHeader>

        <DataTable<ApiKey>
          columns={columns}
          data={keys}
          isLoading={isLoading}
          emptyTitle="No API keys"
          emptyDescription="Create an API key to enable programmatic access."
          loadingRowCount={3}
          rowActions={rowActions}
          cardTitleKey="name"
        />
      </div>

      {/* Create key dialog */}
      <Dialog open={showCreate} onOpenChange={handleCloseCreatedDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdKey ? 'API Key Created' : 'Create API Key'}</DialogTitle>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Copy this key now. It won&apos;t be shown again.
              </p>
              <div className="flex gap-2">
                <Input
                  id="created-key-input"
                  value={createdKey}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                  <span className="sr-only">Copy</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName">Key Name</Label>
                <Input
                  id="keyName"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Production key"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {createdKey ? (
              <Button onClick={handleCloseCreatedDialog}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCloseCreatedDialog}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createKey.isPending}>
                  {createKey.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    'Create'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <Dialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently revoke this API key. Any clients using it will lose access
            immediately.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revokeKey.isPending}>
              {revokeKey.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : 'Revoke'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
