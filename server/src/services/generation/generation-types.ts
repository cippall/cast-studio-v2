// --- Generation Types ---

export interface GenerateOptions {
  layout_type: string;
  model?: string;
  task?: string; // Cast Studio task for model resolution + prompt selection
  num_outputs?: number;
  prompt?: string;
  form_data?: Record<string, unknown>;
  reference_images?: string[];
  randomize?: boolean;
}

export interface GenerateResponse {
  outputs: Array<{
    id: string;
    layout_type: string;
    status: string;
    model: string;
    cost_credits: number;
  }>;
}

export interface CharacterSheetResponse {
  id: string;
  layout_type: string;
  status: string;
  model: string;
  cost_credits: number;
  source_assets: Array<{
    asset_id: string;
    asset_output_id: string;
    layout_type: string;
  }>;
}
