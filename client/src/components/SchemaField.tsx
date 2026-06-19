import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { FalModelSchemaField } from '@/hooks/useAdminModels';

interface SchemaFieldProps {
  name: string;
  field: FalModelSchemaField;
  value: unknown;
  onChange: (val: unknown) => void;
}

export default function SchemaField({ name, field, value, onChange }: SchemaFieldProps) {
  const label = field.title ?? name;
  const description = field.description;

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
