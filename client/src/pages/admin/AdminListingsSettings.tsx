/**
 * AdminListingsSettings — configure marketplace package rules.
 * Required outputs per package type, generic standard look, editorial count.
 * Responsive: stacked mobile, 2-column desktop.
 */
import { useEffect, useState } from 'react';
import { useMarketplaceSettings, useUpdateMarketplaceSettings } from '@/hooks/useMarketplace';
import { useLooks } from '@/hooks/useLooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ACTOR_OUTPUT_OPTIONS = [
  { key: 'headshot', label: 'Headshot' },
  { key: 'fullshot', label: 'Fullshot' },
  { key: 'expressions', label: 'Expression Sheet' },
  { key: 'character_sheet', label: 'Character Sheet' },
  { key: 'editorial', label: 'Editorial Shots' },
];

export default function AdminListingsSettings() {
  const { data: settings, isLoading } = useMarketplaceSettings();
  const updateSettings = useUpdateMarketplaceSettings();
  const { data: looksData } = useLooks({ pageSize: 100 });

  const [requiredOutputs, setRequiredOutputs] = useState<string[]>([]);
  const [genericLookId, setGenericLookId] = useState<string | null>(null);
  const [editorialCount, setEditorialCount] = useState('2');

  const looks = looksData?.data ?? [];

  useEffect(() => {
    if (settings) {
      setRequiredOutputs(settings.actor_package.required_outputs ?? []);
      setGenericLookId(settings.actor_package.generic_standard_look_id ?? null);
      setEditorialCount(String(settings.actor_package.editorial_count ?? 2));
    }
  }, [settings]);

  const toggleOutput = (key: string) => {
    setRequiredOutputs((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        actor_package: {
          required_outputs: requiredOutputs,
          generic_standard_look_id: genericLookId || null,
          editorial_count: parseInt(editorialCount, 10) || 2,
        },
        look_package: settings?.look_package ?? { required_outputs: ['look_image'] },
        fashion_item_package: settings?.fashion_item_package ?? {
          required_outputs: ['item_image'],
        },
      });
      toast.success('Settings saved');
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message ?? 'Failed to save settings');
    }
  };

  if (isLoading || !settings) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        <PageHeader title="Listings Settings" description="Configure marketplace package rules">
          <Button onClick={handleSave} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </PageHeader>

        {/* Package cards: stacked mobile, 2-column desktop */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Actor Package */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Actor Package</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Required outputs</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ACTOR_OUTPUT_OPTIONS.map((opt) => (
                    <div key={opt.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`output-${opt.key}`}
                        checked={requiredOutputs.includes(opt.key)}
                        onCheckedChange={() => toggleOutput(opt.key)}
                      />
                      <Label htmlFor={`output-${opt.key}`} className="text-sm">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Generic Standard Look</Label>
                <Select value={genericLookId} onValueChange={setGenericLookId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a look for character sheet and editorials..." />
                  </SelectTrigger>
                  <SelectContent>
                    {looks.map((look) => (
                      <SelectItem key={look.id} value={look.id}>
                        {look.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  This look is used when generating Character Sheet and Editorial outputs for Actor
                  Packages.
                </p>
              </div>

              {requiredOutputs.includes('editorial') && (
                <div className="space-y-2">
                  <Label htmlFor="editorialCount">Editorial shot count</Label>
                  <Input
                    id="editorialCount"
                    type="number"
                    min="1"
                    max="10"
                    value={editorialCount}
                    onChange={(e) => setEditorialCount(e.target.value)}
                    className="w-32"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Look Package */}
          <Card>
            <CardHeader>
              <CardTitle>Look</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="look-image" checked disabled />
                <Label htmlFor="look-image" className="text-sm">
                  Look Image
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Fashion Item Package */}
          <Card>
            <CardHeader>
              <CardTitle>Fashion Item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="item-image" checked disabled />
                <Label htmlFor="item-image" className="text-sm">
                  Item Image
                </Label>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
