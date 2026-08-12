-- Dental foundation: money in integer cents, audit trail, timeline, roles, createdBy/soft-delete (all additive)

-- Role for dental staff (nullable; only meaningful for dental companies)
ALTER TABLE `AppUser` ADD COLUMN `dentalRole` VARCHAR(191) NULL;
UPDATE `AppUser` SET `dentalRole` = 'owner' WHERE `username` = 'dental';

-- Money as integer cents (keep legacy Float columns in sync for safety)
ALTER TABLE `DentalTreatmentItem` ADD COLUMN `priceCents` INT NOT NULL DEFAULT 0;
ALTER TABLE `DentalTreatmentItem` ADD COLUMN `createdByUserId` INT NULL;
UPDATE `DentalTreatmentItem` SET `priceCents` = ROUND(`price` * 100);

ALTER TABLE `DentalTreatmentPlan` ADD COLUMN `discountCents` INT NOT NULL DEFAULT 0;
ALTER TABLE `DentalTreatmentPlan` ADD COLUMN `createdByUserId` INT NULL;
UPDATE `DentalTreatmentPlan` SET `discountCents` = ROUND(`discount` * 100);

ALTER TABLE `DentalPayment` ADD COLUMN `amountCents` INT NOT NULL DEFAULT 0;
ALTER TABLE `DentalPayment` ADD COLUMN `createdByUserId` INT NULL;
ALTER TABLE `DentalPayment` ADD COLUMN `voidedAt` DATETIME(3) NULL;
ALTER TABLE `DentalPayment` ADD COLUMN `voidReason` VARCHAR(191) NULL;
UPDATE `DentalPayment` SET `amountCents` = ROUND(`amount` * 100);

-- createdBy + soft delete on core records
ALTER TABLE `DentalPatient` ADD COLUMN `createdByUserId` INT NULL;
ALTER TABLE `DentalPatient` ADD COLUMN `deletedAt` DATETIME(3) NULL;
ALTER TABLE `DentalVisit` ADD COLUMN `createdByUserId` INT NULL;
ALTER TABLE `DentalAppointment` ADD COLUMN `createdByUserId` INT NULL;
ALTER TABLE `DentalPrescription` ADD COLUMN `createdByUserId` INT NULL;

CREATE TABLE `DentalAuditLog` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `userId` INT NULL,
  `username` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `entityType` VARCHAR(191) NOT NULL,
  `entityId` VARCHAR(191) NULL,
  `oldValues` TEXT NULL,
  `newValues` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalAuditLog_companyId_createdAt_idx` (`companyId`, `createdAt`),
  INDEX `DentalAuditLog_entity_idx` (`entityType`, `entityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalTimelineEvent` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `refType` VARCHAR(191) NULL,
  `refId` INT NULL,
  `actorName` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalTimelineEvent_patient_idx` (`patientId`, `createdAt`),
  INDEX `DentalTimelineEvent_companyId_idx` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
