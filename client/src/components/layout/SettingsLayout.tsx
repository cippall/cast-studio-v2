/**
 * SettingsLayout — composite layout for the settings section.
 *
 * Desktop: vertical sidebar nav (left) + content area (right).
 * Mobile: horizontal scrollable tab bar + content area.
 *
 * The page component owns which sections are visible based on role;
 * this component owns nav presentation and section switching.
 */
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import PageContainer from '@/components/layout/PageContainer';
import { Separator } from '@/components/ui/separator';

export interface SettingsSection {
  /** Unique key for this section */
  id: string;
  /** Display label in the nav */
  label: string;
  /** Optional icon */
  icon?: ReactNode;
}

export interface SettingsLayoutProps {
  /** Available nav sections */
  sections: SettingsSection[];
  /** Currently active section id */
  activeSection: string;
  /** Callback when user selects a section */
  onSectionChange: (sectionId: string) => void;
  /** Content for the active section */
  children: ReactNode;
  /** Page title shown above the layout */
  title?: string;
}

export default function SettingsLayout({
  sections,
  activeSection,
  onSectionChange,
  children,
  title = 'Settings',
}: SettingsLayoutProps) {
  return (
    <PageContainer>
      <div className="flex flex-col gap-6">
        {/* Page title */}
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{title}</h1>

        {/* Mobile: horizontal scrollable tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-border pb-0 lg:hidden">
          {sections.map((section) => {
            const isActive = section.id === activeSection;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {section.icon}
                {section.label}
              </button>
            );
          })}
        </div>

        {/* Desktop: sidebar + content */}
        <div className="flex gap-6">
          {/* Desktop sidebar nav */}
          <aside className="hidden w-48 shrink-0 lg:block">
            <nav className="flex flex-col gap-0.5">
              {sections.map((section) => {
                const isActive = section.id === activeSection;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => onSectionChange(section.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-none px-3 py-2 text-left text-sm transition-colors',
                      isActive
                        ? 'bg-surface font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-surface hover:text-foreground',
                    )}
                  >
                    {section.icon}
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content area */}
          <div className="min-w-0 flex-1">
            <Separator className="mb-6 hidden lg:block" />
            {children}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
