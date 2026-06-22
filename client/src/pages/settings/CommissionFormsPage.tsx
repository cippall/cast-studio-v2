/**
 * CommissionFormsPage — admin commission form template management.
 * Wrapped in PageContainer for responsive padding.
 */
import { useState } from 'react';
import {
  useAdminCommissionForms,
  useCreateCommissionForm,
  useUpdateCommissionForm,
  useDeleteCommissionForm,
  type CommissionFormTemplate,
} from '@/hooks/useAdminCommissionForms';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import EmptyStateV2 from '@/components/EmptyStateV2';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Loader2, Plus, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CommissionFormsPage() {
  const { data: forms, isLoading } = useAdminCommissionForms();
  const createForm = useCreateCommissionForm();
  const updateForm = useUpdateCommissionForm();
  const deleteForm = useDeleteCommissionForm();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');

  const resetCreate = () => {
    setShowCreate(false);
    setFormName('');
  };

  const resetEdit = () => {
    setEditId(null);
    setFormName('');
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    try {
      await createForm.mutateAsync({
        name: formName.trim(),
        fields: [],
      });
      toast.success('Form created');
      resetCreate();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to create form');
    }
  };

  const handleOpenEdit = (form: CommissionFormTemplate) => {
    setEditId(form.id);
    setFormName(form.name);
  };

  const handleUpdate = async () => {
    if (!editId || !formName.trim()) return;
    try {
      await updateForm.mutateAsync({
        id: editId,
        name: formName.trim(),
      });
      toast.success('Form updated');
      resetEdit();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to update form');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteForm.mutateAsync(deleteId);
      toast.success('Form deleted');
      setDeleteId(null);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to delete form');
    }
  };

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader title="Commission Forms" description="Manage commission form templates">
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 size-4" />
            New Form
          </Button>
        </PageHeader>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : !forms || forms.length === 0 ? (
          <EmptyStateV2
            icon={<Settings2 className="size-8 text-muted-foreground" />}
            title="No forms"
            description="No commission form templates yet."
          />
        ) : (
          <div className="space-y-3">
            {forms.map((form) => (
              <Card key={form.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <h3 className="font-semibold">{form.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {form.fields?.length ?? 0} field{(form.fields?.length ?? 0) !== 1 ? 's' : ''}
                      {form.is_active ? ' \u2022 Active' : ' \u2022 Inactive'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(form)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(form.id)}>
                      <Trash2 className="size-4 text-destructive" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create form dialog */}
        <Dialog open={showCreate} onOpenChange={() => resetCreate()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Commission Form</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">Form Name</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Standard Casting Form"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => resetCreate()}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createForm.isPending || !formName.trim()}>
                {createForm.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit form dialog */}
        <Dialog open={!!editId} onOpenChange={() => resetEdit()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Commission Form</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">Form Name</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Form name"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => resetEdit()}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={updateForm.isPending || !formName.trim()}>
                {updateForm.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Form</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this commission form template?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteForm.isPending}>
                {deleteForm.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
