/**
 * BriefSection — displays commission brief details.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BriefSection({ brief }: { brief: Record<string, unknown> }) {
  const entries = Object.entries(brief).filter(([key]) => key !== 'reference_images');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brief</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {entries.length > 0 ? (
            entries.map(([key, value]) => (
              <div key={key}>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {key.replace(/_/g, ' ')}
                </dt>
                <dd className="mt-0.5 text-sm whitespace-pre-wrap">
                  {typeof value === 'string' ? value : JSON.stringify(value)}
                </dd>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No brief details.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
