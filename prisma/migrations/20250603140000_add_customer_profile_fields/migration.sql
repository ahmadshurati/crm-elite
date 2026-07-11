-- Additive customer profile fields (existing rows keep NULL defaults).

ALTER TABLE `Customer`
  ADD COLUMN `email` VARCHAR(191) NULL,
  ADD COLUMN `address` VARCHAR(500) NULL,
  ADD COLUMN `city` VARCHAR(191) NULL,
  ADD COLUMN `country` VARCHAR(191) NULL,
  ADD COLUMN `birthday` DATETIME(3) NULL,
  ADD COLUMN `gender` VARCHAR(50) NULL,
  ADD COLUMN `occupation` VARCHAR(191) NULL,
  ADD COLUMN `customerStatus` VARCHAR(50) NULL DEFAULT 'فعال',
  ADD COLUMN `source` VARCHAR(191) NULL,
  ADD COLUMN `notes` TEXT NULL,
  ADD COLUMN `tags` VARCHAR(500) NULL,
  ADD COLUMN `profileImage` VARCHAR(500) NULL;
