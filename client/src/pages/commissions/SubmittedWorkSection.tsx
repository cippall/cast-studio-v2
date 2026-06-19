/**
 * SubmittedWorkSection — displays submitted work assets as a responsive thumbnail grid.
 * Responsive: 1 col mobile, 2 col tablet, 3 col desktop.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SubmittedWorkAsset {
  id: string;
  asset_id: string;
  asset_output_id: string | null;
  image_url?: string | null;
}

interface SubmittedWorkSectionProps {
  assets: SubmittedWorkAsset[];
}

export default function SubmittedWorkSection({ assets }: SubmittedWorkSectionProps) {
  if (!assets || assets.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submitted Work</CardTitle>
        <CardDescription>
          {assets.length} {assets.length === 1 ? 'asset' : 'assets'} submitted for review
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <div key={asset.id} className="group relative overflow-hidden border border-border">
              {asset.image_url ? (
                <img
                  src={asset.image_url}
                  alt={`Submitted work ${asset.id}`}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-muted">
                  <span className="text-xs text-muted-foreground">No preview</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
