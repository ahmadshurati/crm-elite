-- AlterTable Customer
ALTER TABLE `Customer` ADD COLUMN `isArchived` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Customer` ADD COLUMN `archivedAt` DATETIME(3) NULL;

-- AlterTable Deal
ALTER TABLE `Deal` ADD COLUMN `isArchived` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `Deal` ADD COLUMN `archivedAt` DATETIME(3) NULL;

-- AlterTable AppUser
ALTER TABLE `AppUser` ADD COLUMN `totpSecret` VARCHAR(191) NULL;
ALTER TABLE `AppUser` ADD COLUMN `totpEnabled` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable Product
CREATE TABLE `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sku` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'insurance',
    `description` TEXT NULL,
    `unitPrice` DOUBLE NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_sku_key`(`sku`),
    INDEX `Product_category_isActive_idx`(`category`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable Contract
CREATE TABLE `Contract` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customerId` INTEGER NOT NULL,
    `createdByUserId` INTEGER NULL,
    `contractNumber` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `renewalDate` DATETIME(3) NULL,
    `documentUrl` VARCHAR(191) NULL,
    `signedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Contract_status_idx`(`status`),
    INDEX `Contract_customerId_idx`(`customerId`),
    INDEX `Contract_endDate_idx`(`endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable EmailTemplate
CREATE TABLE `EmailTemplate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `bodyHtml` TEXT NOT NULL,
    `bodyText` TEXT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'general',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmailTemplate_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable OutboundMessage
CREATE TABLE `OutboundMessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `channel` VARCHAR(191) NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `provider` VARCHAR(191) NULL,
    `providerId` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `customerId` INTEGER NULL,
    `userId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,

    INDEX `OutboundMessage_channel_status_idx`(`channel`, `status`),
    INDEX `OutboundMessage_customerId_idx`(`customerId`),
    INDEX `OutboundMessage_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable ApiKey
CREATE TABLE `ApiKey` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `keyPrefix` VARCHAR(191) NOT NULL,
    `keyHash` VARCHAR(191) NOT NULL,
    `scopes` TEXT NOT NULL,
    `createdByUserId` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastUsedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ApiKey_keyHash_key`(`keyHash`),
    INDEX `ApiKey_keyPrefix_idx`(`keyPrefix`),
    INDEX `ApiKey_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex Deal isArchived
CREATE INDEX `Deal_isArchived_idx` ON `Deal`(`isArchived`);

-- AddForeignKey Contract
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Contract` ADD CONSTRAINT `Contract_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `AppUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey ApiKey
ALTER TABLE `ApiKey` ADD CONSTRAINT `ApiKey_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `AppUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default email templates
INSERT INTO `EmailTemplate` (`name`, `subject`, `bodyHtml`, `bodyText`, `category`, `isActive`, `updatedAt`)
VALUES
  ('renewal-reminder', 'تذكير بتجديد التأمين', '<p>مرحباً {{customerName}}،</p><p>تأمينك ينتهي في {{endDate}}. تواصل معنا للتجديد.</p>', 'مرحباً {{customerName}}، تأمينك ينتهي في {{endDate}}.', 'renewal', true, NOW(3)),
  ('welcome', 'مرحباً بك في Elite Insurance', '<p>مرحباً {{customerName}}،</p><p>شكراً لانضمامك إلينا.</p>', 'مرحباً {{customerName}}، شكراً لانضمامك إلينا.', 'general', true, NOW(3))
ON DUPLICATE KEY UPDATE `updatedAt` = NOW(3);
