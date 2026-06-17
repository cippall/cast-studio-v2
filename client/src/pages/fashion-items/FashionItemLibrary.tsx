import EmptyState from '@/components/EmptyState';

export default function FashionItemLibrary() {
  return (
    <EmptyState
      title="No fashion items yet"
      description="Create your first fashion item to get started."
      actionLabel="New Item"
      actionPath="/fashion-items/new"
    />
  );
}
