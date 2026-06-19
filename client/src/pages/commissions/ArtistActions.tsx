/**
 * ArtistActions — Start Working / Submit Work buttons for assigned artists.
 * No Card wrapper; direct button group with clear visual hierarchy.
 * Primary action (Submit Work) is filled, secondary (Start Working) is outline.
 */
import { useCurrentUser } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';

interface CommissionData {
  id: string;
  status: string;
  assignee_id?: string;
}

export default function ArtistActions({
  commission,
  onStartProgress,
  onSubmitWork,
  pending,
}: {
  commission: CommissionData;
  onStartProgress: () => void;
  onSubmitWork: () => void;
  pending: boolean;
}) {
  const { data: user } = useCurrentUser();
  const isAssigned = commission.assignee_id === user?.id;
  if (!isAssigned) return null;

  const canStart = commission.status === 'ASSIGNED';
  const canSubmit =
    commission.status === 'ASSIGNED' ||
    commission.status === 'IN_PROGRESS' ||
    commission.status === 'CHANGES_REQUESTED';

  if (!canStart && !canSubmit) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-sm font-semibold">Artist Actions</h3>
      {canSubmit && (
        <Button variant="default" onClick={onSubmitWork} disabled={pending}>
          <Send className="mr-1 size-4" />
          Submit Work
        </Button>
      )}
      {canStart && (
        <Button variant="outline" onClick={onStartProgress} disabled={pending}>
          Start Working
        </Button>
      )}
    </div>
  );
}
