-- ============================================================================
-- 012_actor_taxonomy_seed.down.sql
-- Remove all ACTOR_PROPERTY taxonomy entries.
-- ============================================================================

DELETE FROM taxonomy
WHERE category = 'ACTOR_PROPERTY'
  AND key IN ('age', 'gender', 'ethnicity', 'vibe', 'hair_color', 'eye_color', 'body_type');
