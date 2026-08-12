-- Structured medical history for dental patients (additive)

ALTER TABLE `DentalPatient` ADD COLUMN `medDiabetes` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `DentalPatient` ADD COLUMN `medHypertension` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `DentalPatient` ADD COLUMN `medHeartDisease` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `DentalPatient` ADD COLUMN `medBloodThinners` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `DentalPatient` ADD COLUMN `medPregnancy` VARCHAR(191) NOT NULL DEFAULT 'na';
ALTER TABLE `DentalPatient` ADD COLUMN `otherConditions` TEXT NULL;
ALTER TABLE `DentalPatient` ADD COLUMN `medicalReviewedAt` DATETIME(3) NULL;
ALTER TABLE `DentalPatient` ADD COLUMN `medicalReviewedBy` VARCHAR(191) NULL;

-- Seed the demo patients' structured flags from their existing free-text history
UPDATE `DentalPatient` SET `medDiabetes` = 1 WHERE `companyId` = 3 AND `medicalHistory` LIKE '%السكري%';
UPDATE `DentalPatient` SET `medHypertension` = 1 WHERE `companyId` = 3 AND `medicalHistory` LIKE '%ضغط%';
