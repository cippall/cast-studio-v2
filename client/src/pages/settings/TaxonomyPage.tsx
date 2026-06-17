/**
 * TaxonomyPage — admin taxonomy entry management (CRUD).
 * Category is passed via URL param.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useAdminTaxonomy,
  useCreateTaxonomyEntry,
  useUpdateTaxonomyEntry,
  useDeleteTaxonomyEntry,
} from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EmptyState from '@/components/EmptyState';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const INPUT_TYPES = [
  { value: 'DROPDOWN', label: 'Dropdown' },
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'CHECKBOX', label: 'Checkbox' },
];

const CATEGORY_LABELS: Record<string, string> = {
  ACTOR_PROPERTY: 'Actor Properties',
  LOOK_TAXONOMY: 'Look Taxonomy',
  FASHION_ITEM_TAXONOMY: 'Fashion Item Taxonomy',
};

export default function TaxonomyPage() {
  const { cat } = useParams<{ cat: string }>();
  const category = cat ?? 'ACTOR_PROPERTY';

  const { data: entries, isLoading } = useAdminTaxonomy(category);
  const createEntry = useCreateTaxonomyEntry();
  const updateEntry = useUpdateTaxonomyEntry();
  const deleteEntry = useDeleteTaxonomyEntry();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formInputType, setFormInputType] = useState<string | null>(null);
  const [formRequired, setFormRequired] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const resetForm = () => {
    setFormKey('');
    setFormLabel('');
    setFormInputType(null);
    setFormRequired(false);
    setEditId(null);
  };

  const handleOpenNew = () => {
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = (id: string) => {
    const entry = entries?.find((e) => e.id === id);
    if (!entry) return;
    setEditId(id);
    setFormKey(entry.key);
    setFormLabel(entry.label);
    setFormInputType(entry.input_type);
    setFormRequired(entry.is_required);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formKey || !formLabel || !formInputType) {
      toast.error('Key, label, and input type are required');
      return;
    }
    try {
      if (editId) {
        await updateEntry.mutateAsync({
          id: editId,
          key: formKey,
          label: formLabel,
          input_type: formInputType,
          is_required: formRequired,
        });
        toast.success('Entry updated');
      } else {
        await createEntry.mutateAsync({
          category,
          key: formKey,
          label: formLabel,
          input_type: formInputType,
          is_required: formRequired,
          sort_order: (entries?.length ?? 0) + 1,
          is_active: true,
        });
        toast.success('Entry created');
      }
      setShowForm(false);
      resetForm();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to save entry');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteEntry.mutateAsync(deleteId);
      toast.success('Entry deleted');
      setDeleteId(null);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to delete entry');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {CATEGORY_LABELS[category] ?? category}
        </h1>
        <Button onClick={handleOpenNew}>
          <Plus className="mr-2 size-4" />
          Add Entry
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !entries || entries.length === 0 ? (
        <EmptyState
          title="No entries"
          description="No taxonomy entries for this category yet."
          actionLabel="Add Entry"
          actionPath="#"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Input Type</TableHead>
              <TableHead>Required</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-mono text-sm">{entry.key}</TableCell>
                <TableCell>{entry.label}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{entry.input_type}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={entry.is_required ? 'default' : 'outline'}>
                    {entry.is_required ? 'Yes' : 'No'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={entry.is_active ? 'default' : 'outline'}>
                    {entry.is_active ? 'Yes' : 'No'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(entry.id)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(entry.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add/Edit dialog */}
      <Dialog
        open={showForm}
        onOpenChange={() => {
          setShowForm(false);
          resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Entry' : 'Add Entry'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="formKey">Key</Label>
              <Input
                id="formKey"
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                placeholder="body_type"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formLabel">Label</Label>
              <Input
                id="formLabel"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="Body Type"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="formInputType">Input Type</Label>
              <Select value={formInputType} onValueChange={setFormInputType}>
                <SelectTrigger id="formInputType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INPUT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="formRequired"
                checked={formRequired}
                onChange={(e) => setFormRequired(e.target.checked)}
                className="size-4"
              />
              <Label htmlFor="formRequired">Required</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createEntry.isPending || updateEntry.isPending}>
              {createEntry.isPending || updateEntry.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : editId ? (
                'Update'
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Entry</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this taxonomy entry?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteEntry.isPending}>
              {deleteEntry.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
