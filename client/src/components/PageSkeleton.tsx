/**
 * PageSkeleton — loading placeholder shown while lazy-loaded routes fetch.
 * Mirrors the AppShell layout (sidebar + header + content area) to prevent
 * layout shift during route transitions.
 */
export function PageSkeleton() {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar placeholder */}
      <div className="w-64 shrink-0 border-r bg-card animate-pulse" />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header placeholder */}
        <div className="h-16 shrink-0 border-b bg-card">
          <div className="h-full flex items-center px-6">
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          </div>
        </div>

        {/* Content placeholder */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-4">
            <div className="h-8 w-48 rounded bg-muted animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
