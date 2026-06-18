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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import EmptyStateV2 from '@/components/EmptyStateV2';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Loader2, Plus, Key, Copy, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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
      // Fallback: select text in input
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

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader title="API Keys" description="Manage API keys for programmatic access">
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 size-4" />
            New Key
          </Button>
        </PageHeader>

        {/* Desktop table */}
        <div className="hidden md:block">
          {isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-5 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : keys.length === 0 ? (
            <EmptyStateV2
              icon={<Key className="size-8 text-muted-foreground" />}
              title="No API keys"
              description="Create an API key to enable programmatic access."
              actionLabel="New Key"
              actionPath="#"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {key.key}
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.is_active ? 'default' : 'outline'}>
                        {key.is_active ? 'Active' : 'Revoked'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(key.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevokeId(key.id)}
                        className="size-8 p-0"
                        disabled={!key.is_active}
                      >
                        <Trash2 className="size-4 text-destructive" />
                        <span className="sr-only">Revoke</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Mobile card list */}
        <div className="flex flex-col gap-3 md:hidden">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border border-border p-4">
                <Skeleton className="mb-3 h-5 w-32" />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </div>
            ))
          ) : keys.length === 0 ? (
            <EmptyStateV2
              icon={<Key className="size-8 text-muted-foreground" />}
              title="No API keys"
              description="Create an API key to enable programmatic access."
              actionLabel="New Key"
              actionPath="#"
            />
          ) : (
            keys.map((key) => (
              <div key={key.id} className="border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-medium">{key.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRevokeId(key.id)}
                    className="size-8 p-0"
                    disabled={!key.is_active}
                  >
                    <Trash2 className="size-4 text-destructive" />
                    <span className="sr-only">Revoke</span>
                  </Button>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="shrink-0 text-sm text-muted-foreground">Key</span>
                    <span className="truncate text-right font-mono text-sm">{key.key}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={key.is_active ? 'default' : 'outline'}>
                      {key.is_active ? 'Active' : 'Revoked'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Created</span>
                    <span className="text-sm">{new Date(key.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
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
