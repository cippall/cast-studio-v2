-- Migration 010: Create system_prompts table
-- System prompt templates for each generation task, admin-editable

BEGIN;

CREATE TABLE IF NOT EXISTS system_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task VARCHAR(100) NOT NULL UNIQUE,
    template TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_prompts_task ON system_prompts (task);

-- Seed default system prompts for all generation tasks
INSERT INTO system_prompts (task, template, variables) VALUES
('actor_headshot', 'Professional headshot of {{identity_description}}, {{age}} year old {{gender}}, {{ethnicity}} ethnicity, {{vibe}} style. Clean background, studio lighting, sharp focus on face, neutral expression, high resolution portrait photography.', '["identity_description","age","gender","ethnicity","vibe"]'),
('actor_fullshot', 'Full body shot of {{identity_description}}, {{age}} year old {{gender}}, {{ethnicity}} ethnicity, {{vibe}} style. Standing pose, full body visible, clean background, studio lighting, fashion photography.', '["identity_description","age","gender","ethnicity","vibe"]'),
('actor_expressions', 'Expression sheet of {{identity_description}}, {{age}} year old {{gender}}, showing multiple expressions: happy, sad, angry, surprised, neutral, confident. Grid layout, consistent lighting, white background.', '["identity_description","age","gender"]'),
('actor_editorial', 'Editorial fashion photograph of {{identity_description}}, {{age}} year old {{gender}}, wearing {{look_description}}. Dramatic lighting, magazine quality, full body or three-quarter shot, professional fashion photography.', '["identity_description","age","gender","look_description"]'),
('actor_character_sheet', 'Character reference sheet of {{identity_description}}, {{age}} year old {{gender}}, wearing {{look_description}}. Multiple angles: front, side, back. Consistent lighting, white background, character design sheet layout.', '["identity_description","age","gender","look_description"]'),
('look_generation', 'Fashion photograph of {{look_description}}. Full body shot, clean white background, studio lighting, professional clothing photography, no model visible or mannequin style.', '["look_description"]'),
('fashion_item', 'Product photograph of {{item_description}}. Clean white background, studio lighting, centered composition, professional product photography, no shadows.', '["item_description"]'),
('reference_extraction', 'Analyze this image and identify all clothing items, accessories, and fashion elements. For each item, provide: type, color, material, style, and position in the image. Return as structured JSON.', '[]'),
('character_sheet_composition', 'Create a character sheet combining the actor description "{{identity_description}}" with the clothing "{{look_description}}". Show the character from multiple angles (front, side, back) in a clean reference sheet layout. Consistent style, white background, professional character design.', '["identity_description","look_description"]')
ON CONFLICT (task) DO NOTHING;

COMMIT;
