/**
 * CollectionNameEditor — inline editable collection name with save/cancel.
 */
import { Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CollectionNameEditorProps {
  name: string;
  itemCount: number;
  editing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function CollectionNameEditor({
  name,
  itemCount,
  editing,
  editValue,
  onEditChange,
  onStartEdit,
  onSave,
  onCancel,
}: CollectionNameEditorProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave();
                if (e.key === 'Escape') onCancel();
              }}
              className="h-9 w-64"
              autoFocus
            />
            <Button size="sm" onClick={onSave}>
              <Check className="mr-1 size-3" />
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel}>
              <X className="mr-1 size-3" />
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {name}
            </h1>
            <Button
              size="sm"
              variant="ghost"
              onClick={onStartEdit}
              className="size-8 p-0"
              aria-label="Edit collection name"
            >
              <Pencil className="size-3.5 text-muted-foreground" />
            </Button>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {itemCount} item{itemCount !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
