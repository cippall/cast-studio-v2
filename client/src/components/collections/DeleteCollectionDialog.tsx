/**
 * DeleteCollectionDialog — confirmation dialog for deleting a collection.
 */
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface DeleteCollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionName: string;
  itemCount: number;
  onConfirm: () => void;
  isDeleting: boolean;
}

export default function DeleteCollectionDialog({
  open,
  onOpenChange,
  collectionName,
  itemCount,
  onConfirm,
  isDeleting,
}: DeleteCollectionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-error" />
            Delete Collection
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;{collectionName}&rdquo;? This will remove all{' '}
            {itemCount} item
            {itemCount !== 1 ? 's' : ''} from the collection. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Collection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
