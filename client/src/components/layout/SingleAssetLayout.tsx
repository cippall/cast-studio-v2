/**
 * SingleAssetLayout — detail layout for assets with a single output (Looks, Fashion Items).
 *
 * Structure:
 *   - Breadcrumb at top (Library > Item Name)
 *   - Full-width hero image at top (not constrained to sidebar)
 *   - Below image: name, badges, actions in a single row
 *   - Tabbed content: Overview (metadata + source info), Properties (taxonomy)
 *   - No redundant Outputs tab — the image IS the output
 *   - Generation controls inline (regenerate button below image)
 *
 * The page component owns data fetching and action logic;
 * this component owns layout, tabs, and presentation slots.
 */
import { type ReactNode } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

/* -- Types */

export interface SingleAssetLayoutProps {
  /** Breadcrumb library name (e.g. "Looks", "Fashion Items") */
  libraryLabel: string;
  /** Breadcrumb library path (e.g. "/looks", "/fashion-items") */
  libraryPath: string;
  /** Asset name shown in header + breadcrumb */
  name: string;
  /** Type badge text (e.g. "Look", "Fashion Item") */
  typeLabel: string;
  /** Optional status badge (generation or marketplace status) */
  statusBadge?: ReactNode;
  /** Action toolbar buttons (duplicate, submit, delete, etc.) */
  actions: ReactNode;
  /**
   * Hero image — rendered full-width at top of content area.
   * Use w-full with aspect-ratio container, not max-w-md.
   */
  heroImage: ReactNode;
  /** Generation controls rendered below the hero image (regenerate button, etc.) */
  generationControls?: ReactNode;
  /** Overview tab content (metadata, source info) */
  overviewContent: ReactNode;
  /** Properties tab content (taxonomy fields) */
  propertiesContent: ReactNode;
  /** Optional banner shown below header (e.g. frozen notice) */
  banner?: ReactNode;
  /** Whether to show the Properties tab (default: true) */
  showProperties?: boolean;
  /** Additional className for the outer container */
  className?: string;
}

export default function SingleAssetLayout({
  libraryLabel,
  libraryPath,
  name,
  typeLabel,
  statusBadge,
  actions,
  heroImage,
  generationControls,
  overviewContent,
  propertiesContent,
  banner,
  showProperties = true,
  className,
}: SingleAssetLayoutProps) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={libraryPath}>{libraryLabel}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Hero image — full width, not constrained to sidebar */}
      <div className="w-full">
        <div className="aspect-[4/3] w-full overflow-hidden border border-border-subtle bg-surface">
          {heroImage}
        </div>
      </div>

      {/* Generation controls inline below image */}
      {generationControls && (
        <div className="flex flex-wrap items-center gap-2">{generationControls}</div>
      )}

      {/* Header: name, badges, actions */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{typeLabel}</Badge>
              {statusBadge}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </div>
        {banner}
      </div>

      <Separator />

      {/* Tabs — Overview + Properties only (no Outputs tab, image is the output) */}
      <Tabs defaultValue="overview" className="flex flex-col gap-6">
        <TabsList variant="line">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {showProperties && <TabsTrigger value="properties">Properties</TabsTrigger>}
        </TabsList>
        <TabsContent value="overview">{overviewContent}</TabsContent>
        {showProperties && <TabsContent value="properties">{propertiesContent}</TabsContent>}
      </Tabs>
    </div>
  );
}
