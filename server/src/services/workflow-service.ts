import * as walletRepo from '../db/repositories/wallet-repo.js';
import * as workflowRepo from '../db/repositories/workflow-repo.js';
import type { AccountRow, WorkspaceRow } from '../middleware/requireSession.js';
import type { WorkflowStep } from '../db/repositories/workflow-repo.js';

export type { WorkflowStep };

// --- Escrow Cost Configuration ---

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

const DEFAULT_STEP_COST = 0.05;

function calculateStepCost(step: { task: string; options?: { num_outputs?: number } }): number {
  const baseCost = TASK_COSTS[step.task] ?? DEFAULT_STEP_COST;
  const numOutputs = step.options?.num_outputs ?? 1;
  return Number((baseCost * numOutputs).toFixed(4));
}

function calculateMaxEscrow(steps: { task: string; options?: { num_outputs?: number } }[]): number {
  return Number(steps.reduce((sum, step) => sum + calculateStepCost(step), 0).toFixed(4));
}

// --- Workflow Service Types ---

export interface StartWorkflowInput {
  steps: WorkflowStep[];
}

export interface StartWorkflowResult {
  id: string;
  status: string;
  total_escrow: number;
  consumed_credits: number;
  created_at: string;
}

export interface WorkflowStatusResult {
  id: string;
  status: string;
  total_escrow: number;
  consumed_credits: number;
  steps: WorkflowStep[];
  error_code: string | null;
  error_reason: string | null;
}

export interface CancelWorkflowResult {
  id: string;
  status: string;
  refunded_credits: number;
}

// --- Workflow Service Functions ---

export async function startWorkflow(
  account: AccountRow,
  workspace: WorkspaceRow,
  input: StartWorkflowInput,
): Promise<StartWorkflowResult> {
  const totalEscrow = calculateMaxEscrow(input.steps);

  // Find or create wallet
  const wallet = await walletRepo.findWallet({
    workspaceId: workspace.id,
    accountId: account.id,
    allowCreate: true,
  });

  if (!wallet) {
    throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
  }

  // Check sufficient balance
  if (wallet.balance_credits < totalEscrow) {
    throw Object.assign(
      new Error(
        `Insufficient credits. Balance: ${wallet.balance_credits}. Required: ${totalEscrow}.`,
      ),
      { statusCode: 422 },
    );
  }

  // Hold escrow: deduct from wallet balance
  const newBalance = Number((wallet.balance_credits - totalEscrow).toFixed(4));
  await walletRepo.updateWalletBalance(wallet.id, newBalance);

  // Create ESCROW_HOLD ledger entry
  await walletRepo.createLedgerEntry({
    workspaceId: workspace.id,
    walletId: wallet.id,
    amount: Number((-totalEscrow).toFixed(4)),
    type: 'ESCROW_HOLD',
  });

  // Create workflow record
  const workflow = await workflowRepo.createWorkflow({
    workspaceId: workspace.id,
    agentId: account.id,
    walletId: wallet.id,
    totalEscrow,
    steps: input.steps.map((step) => ({
      task: step.task,
      model: step.model,
      status: 'PENDING' as const,
      outputs: [],
    })),
  });

  return {
    id: workflow.id,
    status: workflow.status,
    total_escrow: workflow.total_escrow,
    consumed_credits: workflow.consumed_credits,
    created_at: workflow.created_at,
  };
}

export async function getWorkflowStatus(
  workflowId: string,
  account: AccountRow,
): Promise<WorkflowStatusResult> {
  const workflow = await workflowRepo.findWorkflowById(workflowId);

  if (!workflow) {
    throw Object.assign(new Error('Workflow not found'), { statusCode: 404 });
  }

  // Only the agent who owns the workflow can check status
  if (workflow.agent_id !== account.id) {
    throw Object.assign(new Error('Not authorized to view this workflow'), { statusCode: 403 });
  }

  return {
    id: workflow.id,
    status: workflow.status,
    total_escrow: workflow.total_escrow,
    consumed_credits: workflow.consumed_credits,
    steps: workflow.steps,
    error_code: workflow.error_code,
    error_reason: workflow.error_reason,
  };
}

export async function cancelWorkflow(
  workflowId: string,
  account: AccountRow,
): Promise<CancelWorkflowResult> {
  const workflow = await workflowRepo.findWorkflowById(workflowId);

  if (!workflow) {
    throw Object.assign(new Error('Workflow not found'), { statusCode: 404 });
  }

  // Only the agent who owns the workflow can cancel
  if (workflow.agent_id !== account.id) {
    throw Object.assign(new Error('Not authorized to cancel this workflow'), { statusCode: 403 });
  }

  // Can only cancel RUNNING workflows
  if (workflow.status !== 'RUNNING') {
    throw Object.assign(new Error(`Cannot cancel workflow in '${workflow.status}' status`), {
      statusCode: 409,
    });
  }

  // Calculate refund: unconsumed escrow
  const refundAmount = Number((workflow.total_escrow - workflow.consumed_credits).toFixed(4));

  // Refund unconsumed credits back to wallet
  if (refundAmount > 0) {
    const wallet = await walletRepo.findWallet({
      workspaceId: workflow.workspace_id,
      accountId: account.id,
    });

    if (wallet) {
      const newBalance = Number((wallet.balance_credits + refundAmount).toFixed(4));
      await walletRepo.updateWalletBalance(wallet.id, newBalance);

      // Create ESCROW_REFUND ledger entry
      await walletRepo.createLedgerEntry({
        workspaceId: workflow.workspace_id,
        walletId: wallet.id,
        amount: Number(refundAmount.toFixed(4)),
        type: 'ESCROW_REFUND',
        workflowId: workflow.id,
      });
    }
  }

  // Mark workflow as FAILED (cancelled)
  await workflowRepo.updateWorkflowStatus(
    workflow.id,
    'FAILED',
    'CANCELLED',
    'Workflow cancelled by agent',
  );

  return {
    id: workflow.id,
    status: 'FAILED',
    refunded_credits: refundAmount,
  };
}
