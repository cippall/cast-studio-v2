-- ============================================================================
-- 013_commission_premium_unlocked.up.sql
-- Add idempotency flag to prevent double-charging on commission premium unlock.
-- ============================================================================

ALTER TABLE commissions ADD COLUMN IF NOT EXISTS is_premium_unlocked BOOLEAN NOT NULL DEFAULT FALSE;
