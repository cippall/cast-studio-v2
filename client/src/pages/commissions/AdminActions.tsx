/**
 * AdminActions — Assign commission button for admin.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle>Assign Commission</CardTitle>
        <CardDescription>Assign this commission to an artist or agent.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onAssign}>
          <User className="mr-1 size-4" />
          Assign to Artist/Agent
        </Button>
      </CardContent>
    </Card>
  );
}
