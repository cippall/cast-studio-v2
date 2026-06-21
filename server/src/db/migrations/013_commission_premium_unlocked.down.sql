-- ============================================================================
-- 013_commission_premium_unlocked.down.sql
-- Remove idempotency flag column from commissions.
-- ============================================================================

ALTER TABLE commissions DROP COLUMN IF EXISTS is_premium_unlocked;
