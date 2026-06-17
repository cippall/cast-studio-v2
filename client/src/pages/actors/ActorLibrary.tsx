import EmptyState from '@/components/EmptyState';

export default function ActorLibrary() {
  return (
    <EmptyState
      title="No actors yet"
      description="Create your first actor to get started."
      actionLabel="New Actor"
      actionPath="/actors/new"
    />
  );
}
