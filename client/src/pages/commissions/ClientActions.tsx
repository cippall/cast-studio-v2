/**
 * ClientActions — Approve/Changes buttons for client review.
 * No Card wrapper; direct button group with clear visual hierarchy.
 * Primary action (Approve) is filled, secondary (Request Changes) is outline.
 */
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';

interface CommissionData {
  id: string;
  status: string;
}

export default function ClientActions({
  commission,
  onApprove,
  onChanges,
}: {
  commission: CommissionData;
  onApprove: () => void;
  onChanges: () => void;
}) {
  if (commission.status !== 'SUBMITTED') return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-sm font-semibold">Review Submitted Work</h3>
      <Button variant="default" onClick={onApprove}>
        <CheckCircle className="mr-1 size-4" />
        Approve & Unlock
      </Button>
      <Button variant="outline" onClick={onChanges}>
        <XCircle className="mr-1 size-4" />
        Request Changes
      </Button>
    </div>
  );
}
