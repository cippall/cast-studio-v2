'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { ModelParameterSchema } from '@/hooks/useAdminModels';
import SchemaField from './SchemaField';

interface ModelParameterFormProps {
  schema: ModelParameterSchema | undefined;
  isLoading: boolean;
  initialValues: Record<string, unknown>;
  onSave: (values: Record<string, unknown>) => void;
  isSaving: boolean;
  onCancel: () => void;
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
