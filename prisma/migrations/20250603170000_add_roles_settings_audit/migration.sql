-- Additive: role templates, system settings, audit metadata

CREATE TABLE `RoleTemplate` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `isSystem` BOOLEAN NOT NULL DEFAULT false,
  `viewSubscribers` BOOLEAN NOT NULL DEFAULT true,
  `createSubscribers` BOOLEAN NOT NULL DEFAULT false,
  `editSubscribers` BOOLEAN NOT NULL DEFAULT false,
  `deleteSubscribers` BOOLEAN NOT NULL DEFAULT false,
  `viewAccidents` BOOLEAN NOT NULL DEFAULT true,
  `createAccidents` BOOLEAN NOT NULL DEFAULT false,
  `editAccidents` BOOLEAN NOT NULL DEFAULT false,
  `deleteAccidents` BOOLEAN NOT NULL DEFAULT false,
  `viewAccounting` BOOLEAN NOT NULL DEFAULT false,
  `editPayments` BOOLEAN NOT NULL DEFAULT false,
  `viewUsers` BOOLEAN NOT NULL DEFAULT false,
  `createUsers` BOOLEAN NOT NULL DEFAULT false,
  `editUsers` BOOLEAN NOT NULL DEFAULT false,
  `deleteUsers` BOOLEAN NOT NULL DEFAULT false,
  `viewActivityLog` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `RoleTemplate_name_key`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SystemSetting` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `companyName` VARCHAR(191) NOT NULL DEFAULT 'Elite Insurance',
  `logoUrl` VARCHAR(191) NULL,
  `address` VARCHAR(191) NULL,
  `taxNumber` VARCHAR(191) NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'ILS',
  `language` VARCHAR(191) NOT NULL DEFAULT 'ar',
  `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Hebron',
  `dateFormat` VARCHAR(191) NOT NULL DEFAULT 'yyyy-MM-dd',
  `defaultTaxRate` DOUBLE NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AppUser` ADD COLUMN `roleTemplateId` INTEGER NULL;
ALTER TABLE `AppUser` ADD CONSTRAINT `AppUser_roleTemplateId_fkey` FOREIGN KEY (`roleTemplateId`) REFERENCES `RoleTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ActivityLog` ADD COLUMN `ipAddress` VARCHAR(191) NULL;
ALTER TABLE `ActivityLog` ADD COLUMN `userAgent` TEXT NULL;
