/**
 * AssetDetailLayout — composite layout for detail pages (Actor, Look, FashionItem).
 *
 * Structure:
 *   - Breadcrumb at top (Library > Item Name)
 *   - Header: name, type badge, status badge, action toolbar
 *   - Desktop: image sidebar (left, sticky) + tabs (right)
 *   - Mobile: stacked — image, then tabs
 *   - Tabs: Overview (metadata), Outputs (image grid), Properties (taxonomy)
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

export interface AssetDetailLayoutProps {
  /** Breadcrumb library name (e.g. "Actors", "Looks", "Fashion Items") */
  libraryLabel: string;
  /** Breadcrumb library path (e.g. "/actors", "/looks", "/fashion-items") */
  libraryPath: string;
  /** Asset name shown in header + breadcrumb */
  name: string;
  /** Type badge text (e.g. "Actor", "Look", "Fashion Item") */
  typeLabel: string;
  /** Optional status badge (generation or marketplace status) */
  statusBadge?: ReactNode;
  /** Action toolbar buttons (edit, regenerate, duplicate, submit, etc.) */
  actions: ReactNode;
  /** Main image for the sidebar / stacked mobile view */
  image: ReactNode;
  /** Overview tab content (metadata, image, source info) */
  overviewContent: ReactNode;
  /** Outputs tab content (image grid for actors, single image for look/fashion) */
  outputsContent: ReactNode;
  /** Properties tab content (taxonomy fields) */
  propertiesContent: ReactNode;
  /** Optional banner shown below header (e.g. frozen notice) */
  banner?: ReactNode;
  /** Whether to show the Properties tab (default: true) */
  showProperties?: boolean;
}

export default function AssetDetailLayout({
  libraryLabel,
  libraryPath,
  name,
  typeLabel,
  statusBadge,
  actions,
  image,
  overviewContent,
  outputsContent,
  propertiesContent,
  banner,
  showProperties = true,
}: AssetDetailLayoutProps) {
  return (
    <div className="flex flex-col gap-6">
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

      {/* Header */}
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

      {/* Desktop: image sidebar + tabs | Mobile: stacked */}
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Image sidebar */}
        <div className="shrink-0 lg:sticky lg:top-6 lg:self-start">
          <div className="w-full lg:w-80">{image}</div>
        </div>

        {/* Tabs */}
        <div className="min-w-0 flex-1">
          <Tabs defaultValue="overview" className="flex flex-col gap-6">
            <TabsList variant="line">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="outputs">Outputs</TabsTrigger>
              {showProperties && <TabsTrigger value="properties">Properties</TabsTrigger>}
            </TabsList>
            <TabsContent value="overview">{overviewContent}</TabsContent>
            <TabsContent value="outputs">{outputsContent}</TabsContent>
            {showProperties && <TabsContent value="properties">{propertiesContent}</TabsContent>}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
