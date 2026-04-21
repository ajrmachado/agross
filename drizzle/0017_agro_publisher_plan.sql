-- Migration 0017: Add agro_publisher plan and fix SubscriptionPlan enum
-- 
-- Changes:
--   1. Add 'agro_publisher' to users.subscriptionPlan enum
--   2. Add 'agro_publisher' to organizations.plan enum
--   3. Add 'sending' status to whatsapp_auto_sends for DB-level send lock
--      (prevents race condition / double send)

-- 1. Extend users.subscriptionPlan enum
ALTER TABLE `users`
  MODIFY COLUMN `subscriptionPlan`
    ENUM('morning_call', 'corporativo', 'agro_publisher');

-- 2. Extend organizations.plan enum
ALTER TABLE `organizations`
  MODIFY COLUMN `plan`
    ENUM('morning_call', 'corporativo', 'agro_publisher')
    NOT NULL DEFAULT 'corporativo';

-- 3. Add 'sending' to whatsapp_auto_sends.status (DB send lock)
--    Original: ENUM('pending','sent','failed')
--    New:      ENUM('pending','sending','sent','failed')
ALTER TABLE `whatsapp_auto_sends`
  MODIFY COLUMN `status`
    ENUM('pending', 'sending', 'sent', 'failed')
    NOT NULL DEFAULT 'pending';
