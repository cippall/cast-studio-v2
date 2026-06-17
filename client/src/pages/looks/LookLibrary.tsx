import EmptyState from '@/components/EmptyState';

export default function LookLibrary() {
  return (
    <EmptyState
      title="No looks yet"
      description="Create your first look to get started."
      actionLabel="New Look"
      actionPath="/looks/new"
    />
  );
}
