import { findPromptByTask } from '../db/repositories/prompt-repo.js';

/**
 * Resolve the system prompt template for a given task and fill in variables.
 *
 * Template variables use {{variable_name}} syntax.
 * Example template: "A {{age}} year old {{gender}} with {{vibe}} style"
 * Variables map: { age: "25", gender: "female", vibe: "cyberpunk" }
 * Result: "A 25 year old female with cyberpunk style"
 */
export async function resolvePrompt(
  task: string,
  variables: Record<string, unknown>,
): Promise<string> {
  const prompt = await findPromptByTask(task);
  if (!prompt || !prompt.template) {
    return buildFallbackPrompt(task, variables);
  }

  let resolved = prompt.template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    const replacement = String(value ?? '');
    resolved = resolved.replaceAll(placeholder, replacement);
  }

  return resolved;
}

/**
 * Build a fallback prompt when no system prompt is configured.
 * Covers all 9 task types with sensible defaults.
 */
function buildFallbackPrompt(task: string, variables: Record<string, unknown>): string {
  const identity = variables.identity_description
    ? String(variables.identity_description)
    : JSON.stringify(variables);

  switch (task) {
    case 'actor_headshot':
      return `Professional headshot of ${identity}. Clean background, studio lighting, sharp focus on face.`;
    case 'actor_fullshot':
      return `Full body shot of ${identity}. Standing pose, clean background, studio lighting.`;
    case 'actor_expressions':
      return `Expression sheet of ${identity}. Multiple expressions: happy, sad, angry, surprised, neutral. Grid layout.`;
    case 'actor_editorial':
      return `Editorial fashion photograph of ${identity}. Dramatic lighting, magazine quality.`;
    case 'actor_character_sheet':
      return `Character reference sheet of ${identity}. Multiple angles: front, side, back. Character design sheet layout.`;
    case 'look_generation':
      return `Fashion photograph of ${identity}. Clean white background, studio lighting, professional clothing photography.`;
    case 'fashion_item':
      return `Product photograph of ${identity}. Clean white background, studio lighting, centered composition.`;
    case 'reference_extraction':
      return `Analyze this image and identify all clothing items, accessories, and fashion elements. For each item, provide: type, color, material, style, and position. Return as structured JSON.`;
    case 'character_sheet_composition':
      return `Character sheet combining ${identity}. Multiple angles, clean reference sheet layout.`;
    default:
      return `Generate an image of ${identity}.`;
  }
}
