/**
 * ActorFormFields — dynamic form renderer for Structured Form mode.
 * Fetches taxonomy entries from admin config and renders appropriate
 * input types: TEXT, NUMBER, DROPDOWN, CHECKBOX, SLIDER.
 */
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';

interface TaxonomyEntry {
  id: string;
  category: string;
  key: string;
  label: string;
  input_type: string;
  options?: Array<{ value: string; label: string }>;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

interface ActorFormFieldsProps {
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
}

function useActorTaxonomy() {
  return useQuery<TaxonomyEntry[]>({
    queryKey: ['taxonomy', 'ACTOR_PROPERTY'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/taxonomy?category=ACTOR_PROPERTY');
      return data;
    },
  });
}

function FormField({
  entry,
  value,
  onChange,
}: {
  entry: TaxonomyEntry;
  value: string;
  onChange: (value: string | null) => void;
}) {
  switch (entry.input_type) {
    case 'DROPDOWN':
      return (
        <div className="space-y-2">
          <Label htmlFor={`field-${entry.key}`}>
            {entry.label}
            {entry.is_required && <span className="text-error ml-1">*</span>}
          </Label>
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger id={`field-${entry.key}`}>
              <SelectValue placeholder={`Select ${entry.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {(entry.options ?? []).map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case 'NUMBER':
      return (
        <div className="space-y-2">
          <Label htmlFor={`field-${entry.key}`}>
            {entry.label}
            {entry.is_required && <span className="text-error ml-1">*</span>}
          </Label>
          <Input
            id={`field-${entry.key}`}
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={entry.label}
          />
        </div>
      );

    case 'CHECKBOX':
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`field-${entry.key}`}
            checked={value === 'true'}
            onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          />
          <Label htmlFor={`field-${entry.key}`} className="cursor-pointer font-normal">
            {entry.label}
            {entry.is_required && <span className="text-error ml-1">*</span>}
          </Label>
        </div>
      );

    case 'TEXT':
    default:
      return (
        <div className="space-y-2">
          <Label htmlFor={`field-${entry.key}`}>
            {entry.label}
            {entry.is_required && <span className="text-error ml-1">*</span>}
          </Label>
          <Input
            id={`field-${entry.key}`}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={entry.label}
          />
        </div>
      );
  }
}

export default function ActorFormFields({ values, onChange }: ActorFormFieldsProps) {
  const { data: entries, isLoading, isError, error } = useActorTaxonomy();

  // Initialize empty values for all fields on first load
  useEffect(() => {
    if (entries && entries.length > 0) {
      const initialValues: Record<string, string> = {};
      let hasNewFields = false;
      for (const entry of entries) {
        if (entry.is_active && !(entry.key in values)) {
          initialValues[entry.key] = '';
          hasNewFields = true;
        }
      }
      if (hasNewFields) {
        onChange({ ...values, ...initialValues });
      }
    }
  }, [entries]);

  const handleFieldChange = (key: string, value: string) => {
    onChange({ ...values, [key]: value });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 border border-error/20 bg-error/5 px-3 py-2 text-sm text-error">
        <AlertCircle className="size-4 shrink-0" />
        <span>{error instanceof Error ? error.message : 'Failed to load form fields'}</span>
      </div>
    );
  }

  const activeEntries = (entries ?? [])
    .filter((e) => e.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (activeEntries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No form fields configured. An admin must add actor properties in Settings &gt; Actor
        Properties.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeEntries.map((entry) => (
        <FormField
          key={entry.id}
          entry={entry}
          value={values[entry.key] || ''}
          onChange={(val) => handleFieldChange(entry.key, val ?? '')}
        />
      ))}
    </div>
  );
}
