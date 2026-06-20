export interface FalGenerateParams {
  model: string;
  prompt: string;
  seed: number;
  num_outputs?: number;
  image_size?: string;
  guidance_scale?: number;
  num_inference_steps?: number;
  /** For image-to-image: input image URL */
  image_url?: string;
  /** For image-to-image: strength of the original image */
  strength?: number;
  /** FORM mode: structured input data for generation */
  form_data?: Record<string, unknown>;
  /** REFERENCE mode: array of reference image URLs */
  reference_images?: string[];
}

export interface FalJobResult {
  id: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  image_url: string | null;
  error_message: string | null;
  cost_credits: number;
}

export interface FalModelSchema {
  title: string;
  type: string;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  enum?: string[];
}

export interface FalModel {
  id: string;
  name: string;
  description: string;
  category: 'text_to_image' | 'image_to_image' | 'image_to_text';
  endpoint: string;
  inputSchema?: Record<string, FalModelSchema>;
  outputSchema?: Record<string, FalModelSchema>;
}
