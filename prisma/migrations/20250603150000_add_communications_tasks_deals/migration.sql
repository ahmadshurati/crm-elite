-- Phase 8-10: communications, tasks, deals (additive tables only).

CREATE TABLE `CustomerCommunication` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customerId` INT NOT NULL,
  `userId` INT NULL,
  `username` VARCHAR(191) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `summary` TEXT NOT NULL,
  `attachmentUrl` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `CustomerCommunication_customerId_occurredAt_idx` (`customerId`, `occurredAt`),
  CONSTRAINT `CustomerCommunication_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CustomerCommunication_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `AppUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CrmTask` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customerId` INT NULL,
  `assignedUserId` INT NULL,
  `createdByUserId` INT NULL,
  `title` VARCHAR(191) NOT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'follow-up',
  `description` TEXT NULL,
  `dueDate` DATETIME(3) NOT NULL,
  `dueTime` VARCHAR(20) NULL,
  `priority` VARCHAR(20) NOT NULL DEFAULT 'medium',
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `CrmTask_dueDate_idx` (`dueDate`),
  INDEX `CrmTask_status_idx` (`status`),
  INDEX `CrmTask_customerId_idx` (`customerId`),
  CONSTRAINT `CrmTask_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `CrmTask_assignedUserId_fkey` FOREIGN KEY (`assignedUserId`) REFERENCES `AppUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `CrmTask_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `AppUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Deal` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `customerId` INT NOT NULL,
  `assignedUserId` INT NULL,
  `title` VARCHAR(191) NOT NULL,
  `stage` VARCHAR(50) NOT NULL DEFAULT 'new-lead',
  `value` DOUBLE NOT NULL DEFAULT 0,
  `probability` INT NOT NULL DEFAULT 0,
  `expectedClose` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `Deal_stage_idx` (`stage`),
  INDEX `Deal_customerId_idx` (`customerId`),
  CONSTRAINT `Deal_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Deal_assignedUserId_fkey` FOREIGN KEY (`assignedUserId`) REFERENCES `AppUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
