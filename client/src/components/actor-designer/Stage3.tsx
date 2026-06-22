import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Loader2 } from 'lucide-react';
import ActorFormFields from '@/components/ActorFormFields';

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
  onTaxonomyChange,
  onBack,
  onSave,
  isSaving,
}: Stage3Props) {
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

      <div className="space-y-4">
        <Label>Properties</Label>
        <ActorFormFields values={taxonomyValues} onChange={onTaxonomyChange} />
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
