/**
 * PromptsPage — admin system prompt template management.
 * Wrapped in PageContainer for responsive padding.
 */
import { useState } from 'react';
import {
  useAdminPrompts,
  useUpdatePrompt,
  useDeletePrompt,
  type SystemPrompt,
} from '@/hooks/useAdminPrompts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import EmptyStateV2 from '@/components/EmptyStateV2';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { FileText, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PromptsPage() {
  const { data: prompts, isLoading } = useAdminPrompts();
  const updatePrompt = useUpdatePrompt();
  const deletePrompt = useDeletePrompt();

  const [editId, setEditId] = useState<string | null>(null);
  const [editTemplate, setEditTemplate] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const editPrompt = prompts?.find((p) => p.id === editId);

  const handleOpenEdit = (id: string) => {
    const prompt = prompts?.find((p) => p.id === id);
    if (!prompt) return;
    setEditId(id);
    setEditTemplate(prompt.template);
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    try {
      await updatePrompt.mutateAsync({ id: editId, template: editTemplate });
      toast.success('Prompt updated');
      setEditId(null);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to update prompt');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePrompt.mutateAsync(deleteId);
      toast.success('Prompt deleted');
      setDeleteId(null);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to delete prompt');
    }
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="System Prompts"
          description="Edit prompt templates used for generation"
        />

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : !prompts || prompts.length === 0 ? (
          <EmptyStateV2
            icon={<FileText className="size-8 text-muted-foreground" />}
            title="No prompts"
            description="No system prompt templates configured yet."
          />
        ) : (
          <div className="space-y-3">
            {prompts.map((prompt) => (
              <Card key={prompt.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{prompt.task}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {prompt.template}
                      </p>
                    </div>
                    <div className="ml-4 flex shrink-0 gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(prompt.id)}>
                        <Pencil className="size-4" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(prompt.id)}>
                        <Trash2 className="size-4 text-destructive" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit dialog */}
        <Dialog open={!!editId} onOpenChange={() => setEditId(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Prompt Template</DialogTitle>
            </DialogHeader>
            {editPrompt && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Task: {editPrompt.task}</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template">Template</Label>
                  <Textarea
                    id="template"
                    value={editTemplate}
                    onChange={(e) => setEditTemplate(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditId(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={updatePrompt.isPending}>
                {updatePrompt.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Prompt</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this prompt template?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deletePrompt.isPending}
              >
                {deletePrompt.isPending ? (
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
