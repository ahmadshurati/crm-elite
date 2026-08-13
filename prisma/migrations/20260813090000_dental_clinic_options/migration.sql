-- Clinic-defined dropdown options: doctors & rooms (additive)

CREATE TABLE `DentalClinicOption` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `kind` VARCHAR(20) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdByUserId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalClinicOption_company_kind_idx` (`companyId`, `kind`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed a couple of doctors & rooms for the demo clinic (company 3)
INSERT INTO `DentalClinicOption` (`companyId`, `kind`, `name`, `active`) VALUES
  (3, 'doctor', 'د. أحمد', 1),
  (3, 'doctor', 'د. سارة', 1),
  (3, 'room', 'غرفة 1', 1),
  (3, 'room', 'غرفة 2', 1);
