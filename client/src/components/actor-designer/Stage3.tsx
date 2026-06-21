import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2 } from 'lucide-react';

interface Stage3Props {
  actorName: string;
  onNameChange: (value: string) => void;
  taxonomyValues: Record<string, string>;
  onTaxonomyChange: (values: Record<string, string>) => void;
  onBack: () => void;
  onSave: () => void;
  isSaving: boolean;
}

export default function Stage3({
  actorName,
  onNameChange,
  taxonomyValues,
  onBack,
  onSave,
  isSaving,
}: Stage3Props) {
  const entries = Object.entries(taxonomyValues).filter(([, v]) => v.trim());

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="actor-name">Actor Name</Label>
          <Input
            id="actor-name"
            value={actorName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Cyberpunk Woman"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Properties</Label>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No properties set.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {entries.map(([key, value]) => (
              <div key={key} className="rounded border border-neutral-200 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  {key}
                </p>
                <p className="text-sm text-neutral-900">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 size-4" />
          Back
        </Button>
        <Button onClick={onSave} disabled={isSaving || !actorName.trim()}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Actor'
          )}
        </Button>
      </div>
    </div>
  );
}
