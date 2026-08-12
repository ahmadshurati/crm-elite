-- Tooth surfaces + immutable tooth history (additive)

CREATE TABLE `DentalToothSurface` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `toothNumber` INT NOT NULL,
  `surface` VARCHAR(191) NOT NULL,
  `condition` VARCHAR(191) NOT NULL DEFAULT 'healthy',
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DentalToothSurface_patient_tooth_surface_key` (`patientId`, `toothNumber`, `surface`),
  INDEX `DentalToothSurface_companyId_idx` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalToothHistory` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `toothNumber` INT NOT NULL,
  `surface` VARCHAR(191) NULL,
  `action` VARCHAR(191) NOT NULL,
  `condition` VARCHAR(191) NULL,
  `treatment` VARCHAR(191) NULL,
  `visitId` INT NULL,
  `doctorName` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `createdByUserId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalToothHistory_patient_tooth_idx` (`patientId`, `toothNumber`, `createdAt`),
  INDEX `DentalToothHistory_companyId_idx` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Demo history for patient 1, tooth 26 (matches the classic example) + tooth 16 surfaces
INSERT INTO `DentalToothHistory` (`companyId`, `patientId`, `toothNumber`, `surface`, `action`, `condition`, `treatment`, `doctorName`, `createdAt`) VALUES
 (3, 1, 26, NULL, 'diagnosis', 'caries', NULL, 'د. ليلى', NOW() - INTERVAL 40 DAY),
 (3, 1, 26, NULL, 'treatment', 'root_canal', 'علاج عصب - بدء', 'د. سامي', NOW() - INTERVAL 20 DAY),
 (3, 1, 26, NULL, 'treatment', 'root_canal', 'علاج عصب - اكتمال', 'د. سامي', NOW() - INTERVAL 10 DAY);

INSERT INTO `DentalToothSurface` (`companyId`, `patientId`, `toothNumber`, `surface`, `condition`, `updatedAt`) VALUES
 (3, 1, 16, 'mesial', 'caries', NOW()),
 (3, 1, 16, 'occlusal', 'filling', NOW());

INSERT INTO `DentalToothHistory` (`companyId`, `patientId`, `toothNumber`, `surface`, `action`, `condition`, `createdAt`) VALUES
 (3, 1, 16, 'mesial', 'surface', 'caries', NOW() - INTERVAL 5 DAY),
 (3, 1, 16, 'occlusal', 'surface', 'filling', NOW() - INTERVAL 2 DAY);
