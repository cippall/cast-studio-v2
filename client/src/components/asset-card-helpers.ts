import type { AssetCardType } from '@/components/AssetCard';

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function detailPath(type: AssetCardType, id: string): string {
  if (type === 'actor') return `/actors/${id}`;
  if (type === 'look') return `/looks/${id}`;
  return `/fashion-items/${id}`;
}

export function typeLabel(type: AssetCardType): string {
  if (type === 'actor') return 'Actor';
  if (type === 'look') return 'Look';
  return 'Fashion Item';
}

export function statusVariant(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-success/10 text-success border border-success/20';
    case 'archived':
      return 'bg-muted text-muted-foreground border border-border';
    case 'pending':
      return 'bg-warning/10 text-warning border border-warning/20';
    case 'draft':
      return 'bg-muted text-muted-foreground border border-border';
    default:
      return '';
  }
}

export function marketplaceStatusBadge(status: string): { label: string; classes: string } {
  switch (status) {
    case 'MARKETPLACE_PENDING':
      return { label: 'Pending', classes: 'bg-info/10 text-info border border-info/20' };
    case 'MARKETPLACE_APPROVED':
      return { label: 'Listed', classes: 'bg-success/10 text-success border border-success/20' };
    case 'MARKETPLACE_REJECTED':
      return {
        label: 'Rejected',
        classes: 'bg-destructive/10 text-destructive border border-destructive/20',
      };
    case 'MARKETPLACE_DELISTED':
      return { label: 'Delisted', classes: 'bg-muted text-muted-foreground border border-border' };
    default:
      return { label: status, classes: 'bg-muted text-muted-foreground border border-border' };
  }
}
