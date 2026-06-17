import * as workflowRepo from '../db/repositories/workflow-repo.js';
import * as walletRepo from '../db/repositories/wallet-repo.js';
import type { WorkflowStep } from '../db/repositories/workflow-repo.js';
import { notifyWorkflowCompleted, notifyWorkflowFailed } from '../services/notification-service.js';
import { query } from '../db/pool.js';

// --- Configuration ---

const POLL_INTERVAL_MS = 10000; // Check every 10 seconds
const MAX_BATCH_SIZE = 5;

// --- State ---

let isRunning = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

// --- Worker Logic ---

async function processRunningWorkflows(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    // Find all RUNNING workflows
    const result = await query(
      `SELECT * FROM workflows WHERE status = 'RUNNING' ORDER BY created_at ASC LIMIT $1`,
      [MAX_BATCH_SIZE],
    );

    for (const row of result.rows) {
      try {
        await processWorkflow(row as Record<string, unknown>);
      } catch (err) {
        console.error(`Error processing workflow ${row.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Error finding running workflows:', err);
  } finally {
    isRunning = false;
  }
}

async function processWorkflow(row: Record<string, unknown>): Promise<void> {
  const workflowId = String(row.id);
  const steps = parseSteps(row.steps);
  const consumedCredits = Number(Number.parseFloat(String(row.consumed_credits)).toFixed(4));

  // Find the first PENDING step
  const pendingStepIndex = steps.findIndex((s) => s.status === 'PENDING');
  if (pendingStepIndex === -1) {
    // All steps processed - check if all succeeded
    const allDone = steps.every((s) => s.status === 'SUCCESS' || s.status === 'FAILED');
    const anyFailed = steps.some((s) => s.status === 'FAILED');

    if (allDone) {
      if (anyFailed) {
        await workflowRepo.updateWorkflowStatus(
          workflowId,
          'FAILED',
          'STEP_FAILED',
          'One or more steps failed',
        );
        await notifyAgent(row.agent_id as string, 'WORKFLOW_FAILED', {
          title: 'Workflow Failed',
          message: 'One or more steps in your workflow failed.',
        });
      } else {
        await workflowRepo.updateWorkflowStatus(workflowId, 'COMPLETED');
        await notifyAgent(row.agent_id as string, 'WORKFLOW_COMPLETED', {
          title: 'Workflow Completed',
          message: 'Your workflow has completed successfully.',
        });
      }
    }
    return;
  }

  // Process the pending step
  const step = steps[pendingStepIndex];
  step.status = 'SUCCESS';
  step.outputs = [`output-${workflowId}-${pendingStepIndex}`];

  // Calculate step cost and update consumed credits
  const stepCost = calculateStepCost(step);
  const newConsumed = Number((consumedCredits + stepCost).toFixed(4));

  // Charge the step cost from escrow (create CHARGE ledger entry)
  await walletRepo.createLedgerEntry({
    workspaceId: String(row.workspace_id),
    walletId: String(row.wallet_id),
    amount: Number((-stepCost).toFixed(4)),
    type: 'CHARGE',
    workflowId,
  });

  // Update workflow with new step status and consumed credits
  await workflowRepo.updateWorkflowSteps(workflowId, steps);
  await workflowRepo.updateWorkflowConsumedCredits(workflowId, newConsumed);
}

function parseSteps(raw: unknown): WorkflowStep[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as WorkflowStep[];
    } catch {
      return [];
    }
  }
  return raw as WorkflowStep[];
}

function calculateStepCost(step: WorkflowStep): number {
  const TASK_COSTS: Record<string, number> = {
    actor_headshot: 0.1,
    actor_fullshot: 0.1,
    actor_expressions: 0.05,
    actor_character_sheet: 0.05,
    actor_editorial: 0.1,
    look_generation: 0.05,
    fashion_item_generation: 0.05,
    reference_extraction: 0.02,
  };

  const baseCost = TASK_COSTS[step.task] ?? 0.05;
  const numOutputs = step.outputs?.length ?? 1;
  return Number((baseCost * numOutputs).toFixed(4));
}

async function notifyAgent(
  agentId: string,
  type: 'WORKFLOW_COMPLETED' | 'WORKFLOW_FAILED',
  data: { title: string; message: string },
): Promise<void> {
  try {
    if (type === 'WORKFLOW_COMPLETED') {
      await notifyWorkflowCompleted({
        recipientId: agentId,
        title: data.title,
      });
    } else {
      await notifyWorkflowFailed({
        recipientId: agentId,
        title: data.title,
      });
    }
  } catch (err) {
    console.error('[workflow-worker] Notification error:', err);
  }
}

// --- Lifecycle ---

export function startWorkflowWorker(): void {
  if (intervalHandle) {
    return;
  }

  console.log('Starting workflow worker (poll interval: %dms)', POLL_INTERVAL_MS);
  intervalHandle = setInterval(processRunningWorkflows, POLL_INTERVAL_MS);

  processRunningWorkflows().catch((err) => {
    console.error('Initial workflow worker run failed:', err);
  });
}

export function stopWorkflowWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('Workflow worker stopped');
  }
}
