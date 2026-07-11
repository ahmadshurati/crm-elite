-- Additive: quotes, invoices, notifications

CREATE TABLE `Quote` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `customerId` INTEGER NOT NULL,
  `createdByUserId` INTEGER NULL,
  `quoteNumber` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `lineItems` TEXT NOT NULL,
  `subtotal` DOUBLE NOT NULL DEFAULT 0,
  `taxRate` DOUBLE NOT NULL DEFAULT 0,
  `taxAmount` DOUBLE NOT NULL DEFAULT 0,
  `discount` DOUBLE NOT NULL DEFAULT 0,
  `total` DOUBLE NOT NULL DEFAULT 0,
  `validUntil` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `Quote_status_idx` (`status`),
  INDEX `Quote_customerId_idx` (`customerId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Quote_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Quote_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `AppUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Invoice` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `customerId` INTEGER NOT NULL,
  `quoteId` INTEGER NULL,
  `insuranceId` INTEGER NULL,
  `createdByUserId` INTEGER NULL,
  `invoiceNumber` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `lineItems` TEXT NOT NULL,
  `subtotal` DOUBLE NOT NULL DEFAULT 0,
  `taxRate` DOUBLE NOT NULL DEFAULT 0,
  `taxAmount` DOUBLE NOT NULL DEFAULT 0,
  `discount` DOUBLE NOT NULL DEFAULT 0,
  `total` DOUBLE NOT NULL DEFAULT 0,
  `paidAmount` DOUBLE NOT NULL DEFAULT 0,
  `dueDate` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `Invoice_status_idx` (`status`),
  INDEX `Invoice_customerId_idx` (`customerId`),
  INDEX `Invoice_dueDate_idx` (`dueDate`),
  PRIMARY KEY (`id`),
  CONSTRAINT `Invoice_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Invoice_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `Quote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Invoice_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `AppUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CrmNotification` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `entityType` VARCHAR(191) NULL,
  `entityId` INTEGER NULL,
  `isRead` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `CrmNotification_userId_isRead_idx` (`userId`, `isRead`),
  INDEX `CrmNotification_createdAt_idx` (`createdAt`),
  UNIQUE INDEX `CrmNotification_userId_type_entityType_entityId_key` (`userId`, `type`, `entityType`, `entityId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `CrmNotification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `AppUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
