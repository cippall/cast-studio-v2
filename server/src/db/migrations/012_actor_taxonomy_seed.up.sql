-- ============================================================================
-- 012_actor_taxonomy_seed.up.sql
-- Seed default ACTOR_PROPERTY taxonomy entries for the structured form.
-- These are global (no workspace_id) — admin-defined defaults.
-- Idempotent: safe to re-run.
-- ============================================================================

-- Remove any duplicate entries from prior runs (fixed UUIDs from initial seed).
DELETE FROM taxonomy
WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000007'
);

-- Remove extra workspace-scoped ACTOR_PROPERTY entries not in the 7-field spec.
DELETE FROM taxonomy
WHERE category = 'ACTOR_PROPERTY'
  AND key NOT IN ('age', 'gender', 'ethnicity', 'vibe', 'hair_color', 'eye_color', 'body_type');

-- Upsert global (workspace_id = NULL) default ACTOR_PROPERTY entries.
-- Uses ON CONFLICT on a unique index if present, otherwise plain INSERT.
-- Since there is no unique constraint on key alone, we use a DO-block approach.
DO $$
BEGIN
  -- age
  IF EXISTS (SELECT 1 FROM taxonomy WHERE category = 'ACTOR_PROPERTY' AND key = 'age' AND workspace_id IS NULL) THEN
    UPDATE taxonomy SET label = 'Age', input_type = 'NUMBER', options = NULL, is_required = true, sort_order = 1, is_active = true
    WHERE category = 'ACTOR_PROPERTY' AND key = 'age' AND workspace_id IS NULL;
  ELSE
    INSERT INTO taxonomy (workspace_id, category, key, label, input_type, options, is_required, sort_order, is_active, created_at)
    VALUES (NULL, 'ACTOR_PROPERTY', 'age', 'Age', 'NUMBER', NULL, true, 1, true, NOW());
  END IF;

  -- gender
  IF EXISTS (SELECT 1 FROM taxonomy WHERE category = 'ACTOR_PROPERTY' AND key = 'gender' AND workspace_id IS NULL) THEN
    UPDATE taxonomy SET label = 'Gender', input_type = 'DROPDOWN',
      options = '[{"value":"male","label":"Male"},{"value":"female","label":"Female"},{"value":"non-binary","label":"Non-binary"},{"value":"other","label":"Other"}]'::jsonb,
      is_required = true, sort_order = 2, is_active = true
    WHERE category = 'ACTOR_PROPERTY' AND key = 'gender' AND workspace_id IS NULL;
  ELSE
    INSERT INTO taxonomy (workspace_id, category, key, label, input_type, options, is_required, sort_order, is_active, created_at)
    VALUES (NULL, 'ACTOR_PROPERTY', 'gender', 'Gender', 'DROPDOWN',
      '[{"value":"male","label":"Male"},{"value":"female","label":"Female"},{"value":"non-binary","label":"Non-binary"},{"value":"other","label":"Other"}]'::jsonb,
      true, 2, true, NOW());
  END IF;

  -- ethnicity
  IF EXISTS (SELECT 1 FROM taxonomy WHERE category = 'ACTOR_PROPERTY' AND key = 'ethnicity' AND workspace_id IS NULL) THEN
    UPDATE taxonomy SET label = 'Ethnicity', input_type = 'DROPDOWN',
      options = '[{"value":"caucasian","label":"Caucasian"},{"value":"african","label":"African"},{"value":"asian","label":"Asian"},{"value":"hispanic","label":"Hispanic"},{"value":"middle-eastern","label":"Middle Eastern"},{"value":"mixed","label":"Mixed"},{"value":"other","label":"Other"}]'::jsonb,
      is_required = false, sort_order = 3, is_active = true
    WHERE category = 'ACTOR_PROPERTY' AND key = 'ethnicity' AND workspace_id IS NULL;
  ELSE
    INSERT INTO taxonomy (workspace_id, category, key, label, input_type, options, is_required, sort_order, is_active, created_at)
    VALUES (NULL, 'ACTOR_PROPERTY', 'ethnicity', 'Ethnicity', 'DROPDOWN',
      '[{"value":"caucasian","label":"Caucasian"},{"value":"african","label":"African"},{"value":"asian","label":"Asian"},{"value":"hispanic","label":"Hispanic"},{"value":"middle-eastern","label":"Middle Eastern"},{"value":"mixed","label":"Mixed"},{"value":"other","label":"Other"}]'::jsonb,
      false, 3, true, NOW());
  END IF;

  -- vibe
  IF EXISTS (SELECT 1 FROM taxonomy WHERE category = 'ACTOR_PROPERTY' AND key = 'vibe' AND workspace_id IS NULL) THEN
    UPDATE taxonomy SET label = 'Vibe', input_type = 'TEXT', options = NULL, is_required = false, sort_order = 4, is_active = true
    WHERE category = 'ACTOR_PROPERTY' AND key = 'vibe' AND workspace_id IS NULL;
  ELSE
    INSERT INTO taxonomy (workspace_id, category, key, label, input_type, options, is_required, sort_order, is_active, created_at)
    VALUES (NULL, 'ACTOR_PROPERTY', 'vibe', 'Vibe', 'TEXT', NULL, false, 4, true, NOW());
  END IF;

  -- hair_color
  IF EXISTS (SELECT 1 FROM taxonomy WHERE category = 'ACTOR_PROPERTY' AND key = 'hair_color' AND workspace_id IS NULL) THEN
    UPDATE taxonomy SET label = 'Hair Color', input_type = 'DROPDOWN',
      options = '[{"value":"black","label":"Black"},{"value":"brown","label":"Brown"},{"value":"blonde","label":"Blonde"},{"value":"red","label":"Red"},{"value":"gray","label":"Gray"},{"value":"white","label":"White"},{"value":"bald","label":"Bald"},{"value":"other","label":"Other"}]'::jsonb,
      is_required = false, sort_order = 5, is_active = true
    WHERE category = 'ACTOR_PROPERTY' AND key = 'hair_color' AND workspace_id IS NULL;
  ELSE
    INSERT INTO taxonomy (workspace_id, category, key, label, input_type, options, is_required, sort_order, is_active, created_at)
    VALUES (NULL, 'ACTOR_PROPERTY', 'hair_color', 'Hair Color', 'DROPDOWN',
      '[{"value":"black","label":"Black"},{"value":"brown","label":"Brown"},{"value":"blonde","label":"Blonde"},{"value":"red","label":"Red"},{"value":"gray","label":"Gray"},{"value":"white","label":"White"},{"value":"bald","label":"Bald"},{"value":"other","label":"Other"}]'::jsonb,
      false, 5, true, NOW());
  END IF;

  -- eye_color
  IF EXISTS (SELECT 1 FROM taxonomy WHERE category = 'ACTOR_PROPERTY' AND key = 'eye_color' AND workspace_id IS NULL) THEN
    UPDATE taxonomy SET label = 'Eye Color', input_type = 'DROPDOWN',
      options = '[{"value":"brown","label":"Brown"},{"value":"blue","label":"Blue"},{"value":"green","label":"Green"},{"value":"hazel","label":"Hazel"},{"value":"gray","label":"Gray"},{"value":"amber","label":"Amber"},{"value":"other","label":"Other"}]'::jsonb,
      is_required = false, sort_order = 6, is_active = true
    WHERE category = 'ACTOR_PROPERTY' AND key = 'eye_color' AND workspace_id IS NULL;
  ELSE
    INSERT INTO taxonomy (workspace_id, category, key, label, input_type, options, is_required, sort_order, is_active, created_at)
    VALUES (NULL, 'ACTOR_PROPERTY', 'eye_color', 'Eye Color', 'DROPDOWN',
      '[{"value":"brown","label":"Brown"},{"value":"blue","label":"Blue"},{"value":"green","label":"Green"},{"value":"hazel","label":"Hazel"},{"value":"gray","label":"Gray"},{"value":"amber","label":"Amber"},{"value":"other","label":"Other"}]'::jsonb,
      false, 6, true, NOW());
  END IF;

  -- body_type
  IF EXISTS (SELECT 1 FROM taxonomy WHERE category = 'ACTOR_PROPERTY' AND key = 'body_type' AND workspace_id IS NULL) THEN
    UPDATE taxonomy SET label = 'Body Type', input_type = 'DROPDOWN',
      options = '[{"value":"slim","label":"Slim"},{"value":"athletic","label":"Athletic"},{"value":"average","label":"Average"},{"value":"muscular","label":"Muscular"},{"value":"heavyset","label":"Heavyset"},{"value":"other","label":"Other"}]'::jsonb,
      is_required = false, sort_order = 7, is_active = true
    WHERE category = 'ACTOR_PROPERTY' AND key = 'body_type' AND workspace_id IS NULL;
  ELSE
    INSERT INTO taxonomy (workspace_id, category, key, label, input_type, options, is_required, sort_order, is_active, created_at)
    VALUES (NULL, 'ACTOR_PROPERTY', 'body_type', 'Body Type', 'DROPDOWN',
      '[{"value":"slim","label":"Slim"},{"value":"athletic","label":"Athletic"},{"value":"average","label":"Average"},{"value":"muscular","label":"Muscular"},{"value":"heavyset","label":"Heavyset"},{"value":"other","label":"Other"}]'::jsonb,
      false, 7, true, NOW());
  END IF;
END $$;
