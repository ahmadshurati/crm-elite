-- Clinical encounter (Visit) fields + linking clinical actions to a visit (additive)

ALTER TABLE `DentalVisit` ADD COLUMN `appointmentId` INT NULL;
ALTER TABLE `DentalVisit` ADD COLUMN `examination` TEXT NULL;
ALTER TABLE `DentalVisit` ADD COLUMN `postOp` TEXT NULL;
ALTER TABLE `DentalVisit` ADD COLUMN `nextVisitAt` DATETIME(3) NULL;
ALTER TABLE `DentalVisit` ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'completed';
ALTER TABLE `DentalVisit` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
CREATE INDEX `DentalVisit_appointmentId_idx` ON `DentalVisit` (`appointmentId`);

ALTER TABLE `DentalTreatmentItem` ADD COLUMN `visitId` INT NULL;
CREATE INDEX `DentalTreatmentItem_visitId_idx` ON `DentalTreatmentItem` (`visitId`);

ALTER TABLE `DentalPrescription` ADD COLUMN `visitId` INT NULL;
ALTER TABLE `DentalPrescription` ADD COLUMN `doctorName` VARCHAR(191) NULL;
ALTER TABLE `DentalPrescription` ADD COLUMN `diagnosis` VARCHAR(191) NULL;
CREATE INDEX `DentalPrescription_visitId_idx` ON `DentalPrescription` (`visitId`);
