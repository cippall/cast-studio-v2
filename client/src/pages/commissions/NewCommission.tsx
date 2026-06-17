/**
 * NewCommission — Client commission request form.
 * Renders dynamic form fields from admin-defined template.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useCreateCommission, useCommissionFormTemplates } from '@/hooks/useCommissions';
import type { FormField } from '@cast/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send } from 'lucide-react';

interface FormData {
  title: string;
  brief: Record<string, string>;
}

export default function NewCommission() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: templates, isLoading: templatesLoading } = useCommissionFormTemplates();
  const activeTemplate = templates?.find((t) => t.is_active);
  const fields = activeTemplate?.fields ?? [];

  const form = useForm<FormData>({
    defaultValues: {
      title: '',
      brief: Object.fromEntries(fields.map((f) => [f.key, ''])),
    },
  });

  const createMutation = useCreateCommission();

  const onSubmit = async (data: FormData) => {
    if (!data.title.trim()) {
      setSubmitError('Title is required.');
      return;
    }
    setSubmitError(null);
    try {
      await createMutation.mutateAsync({
        title: data.title,
        brief: data.brief,
      });
      navigate('/commissions');
    } catch (err: unknown) {
      const error = err as { message?: string };
      setSubmitError(error.message ?? 'Failed to submit commission. Please try again.');
    }
  };

  if (templatesLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="space-y-4 py-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/commissions')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Commission</h1>
          <p className="text-sm text-muted-foreground">
            Submit a commission request for the studio team.
          </p>
        </div>
      </div>

      {submitError && (
        <Card className="border-destructive">
          <CardContent className="py-3 text-sm text-destructive">{submitError}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Commission Request</CardTitle>
          <CardDescription>
            Fill out the details below. An admin will review and assign your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <label htmlFor="title" className="text-sm font-medium">
                Title
              </label>
              <Input
                id="title"
                placeholder="e.g. Cyberpunk editorial shoot"
                {...form.register('title')}
              />
              <p className="text-sm text-muted-foreground">
                A short descriptive title for your request.
              </p>
            </div>

            {fields.map((fieldDef) => (
              <div key={fieldDef.key} className="grid gap-2">
                <label htmlFor={fieldDef.key} className="text-sm font-medium">
                  {fieldDef.label}
                </label>
                {fieldDef.type === 'textarea' ? (
                  <Textarea
                    id={fieldDef.key}
                    placeholder={fieldDef.placeholder}
                    rows={4}
                    {...form.register(`brief.${fieldDef.key}`)}
                  />
                ) : fieldDef.type === 'select' ? (
                  <Select
                    onValueChange={(val) => {
                      const currentBrief = form.getValues('brief');
                      form.setValue('brief', {
                        ...currentBrief,
                        [fieldDef.key]: val ?? '',
                      } as Record<string, string>);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={fieldDef.placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldDef.options?.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id={fieldDef.key}
                    type={fieldDef.type === 'number' ? 'number' : 'text'}
                    placeholder={fieldDef.placeholder}
                    {...form.register(`brief.${fieldDef.key}`)}
                  />
                )}
              </div>
            ))}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={createMutation.isPending}>
                <Send className="mr-1 size-4" />
                {createMutation.isPending ? 'Submitting...' : 'Submit Commission'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/commissions')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
