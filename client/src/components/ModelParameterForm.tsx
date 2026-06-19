'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';
import type { ModelParameterSchema, FalModelSchemaField } from '@/hooks/useAdmin';

interface ModelParameterFormProps {
  schema: ModelParameterSchema | undefined;
  isLoading: boolean;
  initialValues: Record<string, unknown>;
  onSave: (values: Record<string, unknown>) => void;
  isSaving: boolean;
  onCancel: () => void;
}

/**
 * Render a single form field based on a fal.ai schema property.
 * number with min/max => Slider
 * string with enum => Select dropdown
 * string => text input
 * number without range => number input
 */
function SchemaField({
  name,
  field,
  value,
  onChange,
}: {
  name: string;
  field: FalModelSchemaField;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const label = field.title ?? name;
  const description = field.description;

  // Enum => Select dropdown
  if (field.enum && field.enum.length > 0) {
    const strValue = String(value ?? field.default ?? '');
    return (
      <div className="space-y-2">
        <Label htmlFor={`param-${name}`}>{label}</Label>
        <Select value={strValue} onValueChange={(v) => onChange(v)}>
          <SelectTrigger id={`param-${name}`}>
            <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.enum.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {description && <p className="text-xs text-[#A8A29E]">{description}</p>}
      </div>
    );
  }

  // Number with min/max => Slider
  if (field.type === 'number' && field.minimum !== undefined && field.maximum !== undefined) {
    const numValue = Number(value ?? field.default ?? field.minimum);
    const step = field.maximum - field.minimum <= 10 ? 0.1 : 1;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`param-${name}`}>{label}</Label>
          <span className="text-sm font-mono text-[#57534E]">{numValue}</span>
        </div>
        <Slider
          id={`param-${name}`}
          min={field.minimum}
          max={field.maximum}
          step={step}
          value={[numValue]}
          onValueChange={(vals) => onChange(Array.isArray(vals) ? vals[0] : vals)}
        />
        {description && <p className="text-xs text-[#A8A29E]">{description}</p>}
      </div>
    );
  }

  // Number without range => number input
  if (field.type === 'number') {
    const numValue = value ?? field.default ?? '';
    return (
      <div className="space-y-2">
        <Label htmlFor={`param-${name}`}>{label}</Label>
        <Input
          id={`param-${name}`}
          type="number"
          value={String(numValue)}
          onChange={(e) => onChange(Number(e.target.value))}
          min={field.minimum}
          max={field.maximum}
          step={field.maximum !== undefined && field.maximum - (field.minimum ?? 0) <= 10 ? 0.1 : 1}
        />
        {description && <p className="text-xs text-[#A8A29E]">{description}</p>}
      </div>
    );
  }

  // Boolean
  if (field.type === 'boolean') {
    const boolValue = Boolean(value ?? field.default ?? false);
    return (
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id={`param-${name}`}
          checked={boolValue}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 border-[#D6D3D1] bg-[#FAFAF9] accent-[#78716C]"
        />
        <Label htmlFor={`param-${name}`} className="cursor-pointer">
          {label}
        </Label>
        {description && <p className="text-xs text-[#A8A29E]">{description}</p>}
      </div>
    );
  }

  // Default: string => text input
  const strValue = String(value ?? field.default ?? '');
  return (
    <div className="space-y-2">
      <Label htmlFor={`param-${name}`}>{label}</Label>
      <Input
        id={`param-${name}`}
        type="text"
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
      />
      {description && <p className="text-xs text-[#A8A29E]">{description}</p>}
    </div>
  );
}

export default function ModelParameterForm({
  schema,
  isLoading,
  initialValues,
  onSave,
  isSaving,
  onCancel,
}: ModelParameterFormProps) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);

  // Sync initial values when they change (e.g. dialog opens with new model)
  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const inputFields = schema?.input ?? {};
  const fieldNames = Object.keys(inputFields);

  const handleFieldChange = (name: string, val: unknown) => {
    setValues((prev) => ({ ...prev, [name]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(values);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-[#A8A29E]" />
        <span className="ml-2 text-sm text-[#A8A29E]">Loading parameter schema...</span>
      </div>
    );
  }

  if (fieldNames.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-[#A8A29E]">No configurable parameters exposed by this model.</p>
        <p className="mt-1 text-xs text-[#A8A29E]">
          The model may use default settings or the schema endpoint is unavailable.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-5">
        {fieldNames.map((name) => (
          <SchemaField
            key={name}
            name={name}
            field={inputFields[name]}
            value={values[name]}
            onChange={(val) => handleFieldChange(name, val)}
          />
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-[#E7E5E4] pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save Parameters
        </Button>
      </div>
    </form>
  );
}
