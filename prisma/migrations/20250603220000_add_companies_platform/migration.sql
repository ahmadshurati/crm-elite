-- Platform multi-company support (additive)

CREATE TABLE `Company` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `isDemo` BOOLEAN NOT NULL DEFAULT false,
  `contactEmail` VARCHAR(191) NULL,
  `contactPhone` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Company_slug_key` (`slug`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `Company` (`id`, `name`, `slug`, `isActive`, `isDemo`)
VALUES (1, 'Elite Insurance', 'elite-insurance', true, false);

INSERT INTO `Company` (`id`, `name`, `slug`, `isActive`, `isDemo`, `notes`)
VALUES (2, 'عرض تجريبي', 'demo', true, true, 'حساب تجريبي للعروض التقديمية');

ALTER TABLE `AppUser` ADD COLUMN `companyId` INT NULL;
ALTER TABLE `AppUser` ADD INDEX `AppUser_companyId_idx` (`companyId`);
ALTER TABLE `AppUser` ADD CONSTRAINT `AppUser_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE `AppUser` SET `companyId` = 1 WHERE `companyId` IS NULL AND `role` != 'platform_owner';

ALTER TABLE `Customer` ADD COLUMN `companyId` INT NOT NULL DEFAULT 1;
ALTER TABLE `Customer` ADD INDEX `Customer_companyId_idx` (`companyId`);
ALTER TABLE `Customer` ADD CONSTRAINT `Customer_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE `Customer` SET `companyId` = 1 WHERE `companyId` = 1;

ALTER TABLE `SystemSetting` ADD COLUMN `companyId` INT NULL;
UPDATE `SystemSetting` SET `companyId` = 1 WHERE `id` = 1;
ALTER TABLE `SystemSetting` ADD UNIQUE INDEX `SystemSetting_companyId_key` (`companyId`);
ALTER TABLE `SystemSetting` ADD CONSTRAINT `SystemSetting_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `SystemSetting` (`companyId`, `companyName`, `currency`, `language`, `timezone`, `dateFormat`, `defaultTaxRate`, `updatedAt`)
SELECT 2, 'عرض تجريبي', `currency`, `language`, `timezone`, `dateFormat`, `defaultTaxRate`, NOW()
FROM `SystemSetting` WHERE `companyId` = 1
ON DUPLICATE KEY UPDATE `companyName` = VALUES(`companyName`);
