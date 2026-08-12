-- Imaging, documents & files (additive)

CREATE TABLE `DentalFile` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `toothNumber` INT NULL,
  `visitId` INT NULL,
  `treatmentId` INT NULL,
  `category` VARCHAR(191) NOT NULL DEFAULT 'other',
  `fileUrl` VARCHAR(1000) NOT NULL,
  `fileName` VARCHAR(255) NOT NULL,
  `mimeType` VARCHAR(191) NULL,
  `sizeBytes` INT NULL,
  `description` VARCHAR(500) NULL,
  `uploadedByUserId` INT NULL,
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalFile_patient_idx` (`patientId`, `createdAt`),
  INDEX `DentalFile_patient_tooth_idx` (`patientId`, `toothNumber`),
  INDEX `DentalFile_companyId_idx` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
