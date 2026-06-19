/**
 * CreateCollectionDialog — dialog for creating a new collection.
 * Replaces the browser-native prompt() with a custom Dialog.
 */
import { useState, useEffect } from 'react';
import { Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface CreateCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
  isCreating: boolean;
}

const MAX_NAME_LENGTH = 255;

export default function CreateCollectionDialog({
  open,
  onOpenChange,
  onSubmit,
  isCreating,
}: CreateCollectionDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setError('');
    }
  }, [open]);

  const validate = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Collection name is required.');
      return false;
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      setError(`Collection name must be ${MAX_NAME_LENGTH} characters or less.`);
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = () => {
    if (validate(name)) {
      onSubmit(name.trim());
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (error) {
      validate(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="size-5 text-primary" />
            New Collection
          </DialogTitle>
          <DialogDescription>Create a new collection to organize your assets.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          <Label htmlFor="collection-name">Collection name</Label>
          <Input
            id="collection-name"
            placeholder="Enter collection name..."
            value={name}
            onChange={handleNameChange}
            onKeyDown={handleKeyDown}
            maxLength={MAX_NAME_LENGTH}
            autoFocus
            aria-invalid={!!error}
          />
          {error ? (
            <p className="text-xs text-error">{error}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {name.length}/{MAX_NAME_LENGTH} characters
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
