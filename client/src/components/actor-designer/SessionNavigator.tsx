import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import type { GenerationSession } from './types';

interface SessionNavigatorProps {
  sessions: GenerationSession[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onLoadSettings: () => void;
}

export default function SessionNavigator({
  sessions,
  selectedIndex,
  onSelect,
  onLoadSettings,
}: SessionNavigatorProps) {
  if (sessions.length <= 1) return null;

  return (
    <div className="flex items-center justify-between border border-border-subtle bg-muted/30 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          disabled={selectedIndex === 0}
          onClick={() => onSelect(selectedIndex - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-muted-foreground">
          Session {selectedIndex + 1} of {sessions.length}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="size-7 p-0"
          disabled={selectedIndex === sessions.length - 1}
          onClick={() => onSelect(selectedIndex + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={onLoadSettings}>
        <Settings2 className="size-3" />
        Load Settings
      </Button>
    </div>
  );
}
