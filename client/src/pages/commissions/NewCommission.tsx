/**
 * NewCommission — Client commission request form.
 * Renders dynamic form fields from admin-defined template.
 * Uses PageContainer + PageHeader.
 * Responsive: single column mobile, 2-column desktop (form fields in 2 cols).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useCreateCommission, useCommissionFormTemplates } from '@/hooks/useCommissions';
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
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';

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
      brief: {},
    },
  });

  // Reset brief defaults when template fields change
  useEffect(() => {
    if (fields.length > 0) {
      form.reset({
        title: form.getValues('title'),
        brief: Object.fromEntries(fields.map((f) => [f.key, ''])),
      });
    }
  }, [fields, form]);

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
      <PageContainer>
        <PageHeader title="New Commission" />
        <Card>
          <CardContent className="space-y-4 py-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <PageHeader
          title="New Commission"
          description="Submit a commission request for the studio team."
        />

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
              {/* Title — always full width */}
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

              {/* Dynamic fields — 2 columns on desktop */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              </div>

              {/* Actions — stacked mobile, inline desktop */}
              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:gap-3">
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
    </PageContainer>
  );
}
