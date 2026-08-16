-- WhatsApp auto-reply (menu with options) settings, per clinic (additive)

ALTER TABLE `DentalWhatsAppConfig`
  ADD COLUMN `autoReplyEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `autoReplyText` TEXT NULL,
  ADD COLUMN `autoReplyOptions` TEXT NULL,
  ADD COLUMN `autoReplyCooldownMin` INT NOT NULL DEFAULT 120;
