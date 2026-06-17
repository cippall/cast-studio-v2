import { Router } from 'express';
import { requireApiKey } from '../middleware/requireApiKey.js';
import { z } from 'zod';
import type { Request, Response } from 'express';
import * as workflowService from '../services/workflow-service.js';
import type { WorkflowStep } from '../services/workflow-service.js';

const router = Router();

// --- Validation Schemas ---

const workflowStepSchema = z.object({
  task: z.string().min(1),
  model: z.string().min(1),
  prompt_recipe: z.record(z.string(), z.unknown()).optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

const startWorkflowSchema = z.object({
  steps: z.array(workflowStepSchema).min(1, 'At least one step is required'),
});

function toWorkflowSteps(steps: z.infer<typeof workflowStepSchema>[]): WorkflowStep[] {
  return steps.map((step) => ({
    task: step.task,
    model: step.model,
    status: 'PENDING' as const,
    outputs: [],
    prompt_recipe: step.prompt_recipe,
    options: step.options,
  }));
}

// --- Routes (all require API key auth) ---

router.post('/start', requireApiKey, async (req: Request, res: Response) => {
  try {
    const parsed = startWorkflowSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const result = await workflowService.startWorkflow(req.account!, req.workspace!, {
      steps: toWorkflowSteps(parsed.data.steps),
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Start workflow error:', err);
    const status =
      err && typeof err === 'object' && 'statusCode' in err
        ? (err as { statusCode: number }).statusCode
        : 500;
    res.status(status).json({
      error: { code: 'WORKFLOW_ERROR', message: (err as Error).message },
    });
  }
});

router.get('/:id', requireApiKey, async (req: Request, res: Response) => {
  try {
    const result = await workflowService.getWorkflowStatus(req.params.id, req.account!);
    res.json(result);
  } catch (err) {
    console.error('Get workflow error:', err);
    const status =
      err && typeof err === 'object' && 'statusCode' in err
        ? (err as { statusCode: number }).statusCode
        : 500;
    res.status(status).json({
      error: { code: 'WORKFLOW_ERROR', message: (err as Error).message },
    });
  }
});

router.post('/:id/cancel', requireApiKey, async (req: Request, res: Response) => {
  try {
    const result = await workflowService.cancelWorkflow(req.params.id, req.account!);
    res.json(result);
  } catch (err) {
    console.error('Cancel workflow error:', err);
    const status =
      err && typeof err === 'object' && 'statusCode' in err
        ? (err as { statusCode: number }).statusCode
        : 500;
    res.status(status).json({
      error: { code: 'WORKFLOW_ERROR', message: (err as Error).message },
    });
  }
});

export default router;
