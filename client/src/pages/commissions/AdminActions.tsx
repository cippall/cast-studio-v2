/**
 * AdminActions — Assign commission button for admin.
 * No Card wrapper; direct button group for clear visual hierarchy.
 */
import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';

interface CommissionData {
  id: string;
  status: string;
}

export default function AdminActions({
  commission,
  onAssign,
}: {
  commission: CommissionData;
  onAssign: () => void;
}) {
  if (commission.status !== 'REQUESTED') return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-sm font-semibold">Admin Actions</h3>
      <Button variant="default" onClick={onAssign}>
        <User className="mr-1 size-4" />
        Assign to Artist/Agent
      </Button>
    </div>
  );
}
