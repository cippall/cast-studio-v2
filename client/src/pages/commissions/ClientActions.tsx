/**
 * ClientActions — Approve/Changes buttons for client review.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle>Review Submitted Work</CardTitle>
        <CardDescription>Review the work and approve or request changes.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button onClick={onApprove}>
          <CheckCircle className="mr-1 size-4" />
          Approve & Unlock
        </Button>
        <Button variant="outline" onClick={onChanges}>
          <XCircle className="mr-1 size-4" />
          Request Changes
        </Button>
      </CardContent>
    </Card>
  );
}
