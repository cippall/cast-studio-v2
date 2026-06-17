import { query } from '../pool.js';

export type WorkflowStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface WorkflowStep {
  task: string;
  model: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  outputs: string[];
  prompt_recipe?: Record<string, unknown>;
  options?: Record<string, unknown>;
  error_code?: string;
  error_reason?: string;
}

export interface WorkflowRow {
  id: string;
  workspace_id: string;
  agent_id: string;
  wallet_id: string;
  total_escrow: number;
  consumed_credits: number;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  error_code: string | null;
  error_reason: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface CreateWorkflowInput {
  workspaceId: string;
  agentId: string;
  walletId: string;
  totalEscrow: number;
  steps: WorkflowStep[];
}

export interface StartWorkflowResult {
  workflow: WorkflowRow;
  escrowLedgerEntry: {
    id: string;
    amount: number;
    type: string;
  };
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

function asWorkflowRow(row: Record<string, unknown>): WorkflowRow {
  return {
    id: String(row.id),
    workspace_id: String(row.workspace_id),
    agent_id: String(row.agent_id),
    wallet_id: String(row.wallet_id),
    total_escrow: Number(Number.parseFloat(String(row.total_escrow)).toFixed(4)),
    consumed_credits: Number(Number.parseFloat(String(row.consumed_credits)).toFixed(4)),
    status: String(row.status) as WorkflowStatus,
    steps: parseSteps(row.steps),
    error_code: row.error_code == null ? null : String(row.error_code),
    error_reason: row.error_reason == null ? null : String(row.error_reason),
    created_at: String(row.created_at),
    completed_at: row.completed_at == null ? null : String(row.completed_at),
  };
}

export async function createWorkflow(input: CreateWorkflowInput): Promise<WorkflowRow> {
  const stepsJson = JSON.stringify(input.steps);
  const result = await query(
    `INSERT INTO workflows (workspace_id, agent_id, wallet_id, total_escrow, consumed_credits, status, steps)
     VALUES ($1, $2, $3, $4, 0, 'RUNNING', $5)
     RETURNING *`,
    [
      input.workspaceId,
      input.agentId,
      input.walletId,
      Number(input.totalEscrow.toFixed(4)),
      stepsJson,
    ],
  );

  return asWorkflowRow(result.rows[0] as Record<string, unknown>);
}

export async function findWorkflowById(id: string): Promise<WorkflowRow | null> {
  const result = await query('SELECT * FROM workflows WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return asWorkflowRow(result.rows[0] as Record<string, unknown>);
}

export async function updateWorkflowStatus(
  id: string,
  status: WorkflowStatus,
  errorCode?: string,
  errorReason?: string,
): Promise<WorkflowRow | null> {
  const result = await query(
    `UPDATE workflows
     SET status = $1,
         error_code = COALESCE($2, error_code),
         error_reason = COALESCE($3, error_reason),
         completed_at = CASE WHEN $1 IN ('COMPLETED', 'FAILED') THEN NOW() ELSE completed_at END
     WHERE id = $4
     RETURNING *`,
    [status, errorCode ?? null, errorReason ?? null, id],
  );

  if (result.rows.length === 0) return null;
  return asWorkflowRow(result.rows[0] as Record<string, unknown>);
}

export async function updateWorkflowSteps(
  id: string,
  steps: WorkflowStep[],
): Promise<WorkflowRow | null> {
  const result = await query(`UPDATE workflows SET steps = $1 WHERE id = $2 RETURNING *`, [
    JSON.stringify(steps),
    id,
  ]);

  if (result.rows.length === 0) return null;
  return asWorkflowRow(result.rows[0] as Record<string, unknown>);
}

export async function updateWorkflowConsumedCredits(
  id: string,
  consumedCredits: number,
): Promise<WorkflowRow | null> {
  const result = await query(
    `UPDATE workflows SET consumed_credits = $1 WHERE id = $2 RETURNING *`,
    [Number(consumedCredits.toFixed(4)), id],
  );

  if (result.rows.length === 0) return null;
  return asWorkflowRow(result.rows[0] as Record<string, unknown>);
}
