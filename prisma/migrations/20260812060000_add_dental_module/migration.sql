-- Dental Practice Management module (fully additive; does NOT touch Elite tables/data)

-- Company vertical type (default keeps all existing companies as 'insurance')
ALTER TABLE `Company` ADD COLUMN `type` VARCHAR(191) NOT NULL DEFAULT 'insurance';

CREATE TABLE `DentalPatient` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientNumber` VARCHAR(191) NOT NULL,
  `fullName` VARCHAR(191) NOT NULL,
  `nationalId` VARCHAR(191) NULL,
  `birthDate` DATE NULL,
  `gender` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `whatsapp` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `address` VARCHAR(191) NULL,
  `emergencyContact` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `medicalHistory` TEXT NULL,
  `allergies` TEXT NULL,
  `medications` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalPatient_companyId_idx` (`companyId`),
  INDEX `DentalPatient_phone_idx` (`phone`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalAppointment` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `doctorName` VARCHAR(191) NULL,
  `treatmentType` VARCHAR(191) NULL,
  `startAt` DATETIME(3) NOT NULL,
  `durationMin` INT NOT NULL DEFAULT 30,
  `room` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'scheduled',
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalAppointment_companyId_startAt_idx` (`companyId`, `startAt`),
  INDEX `DentalAppointment_patientId_idx` (`patientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalVisit` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `visitDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `doctorName` VARCHAR(191) NULL,
  `chiefComplaint` VARCHAR(191) NULL,
  `diagnosis` TEXT NULL,
  `teeth` VARCHAR(191) NULL,
  `procedures` TEXT NULL,
  `anesthesia` VARCHAR(191) NULL,
  `medications` TEXT NULL,
  `notes` TEXT NULL,
  `recommendations` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalVisit_companyId_idx` (`companyId`),
  INDEX `DentalVisit_patientId_idx` (`patientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalToothCondition` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `toothNumber` INT NOT NULL,
  `condition` VARCHAR(191) NOT NULL DEFAULT 'healthy',
  `notes` TEXT NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DentalToothCondition_patient_tooth_key` (`patientId`, `toothNumber`),
  INDEX `DentalToothCondition_companyId_idx` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalTreatmentPlan` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `title` VARCHAR(191) NOT NULL DEFAULT 'خطة علاج',
  `discount` DOUBLE NOT NULL DEFAULT 0,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalTreatmentPlan_companyId_idx` (`companyId`),
  INDEX `DentalTreatmentPlan_patientId_idx` (`patientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalTreatmentItem` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `planId` INT NOT NULL,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `toothNumber` INT NULL,
  `treatment` VARCHAR(191) NOT NULL,
  `price` DOUBLE NOT NULL DEFAULT 0,
  `status` VARCHAR(191) NOT NULL DEFAULT 'proposed',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalTreatmentItem_planId_idx` (`planId`),
  INDEX `DentalTreatmentItem_patientId_idx` (`patientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalPayment` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `amount` DOUBLE NOT NULL DEFAULT 0,
  `method` VARCHAR(191) NOT NULL DEFAULT 'cash',
  `notes` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalPayment_companyId_createdAt_idx` (`companyId`, `createdAt`),
  INDEX `DentalPayment_patientId_idx` (`patientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalPrescription` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `items` TEXT NOT NULL,
  `notes` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalPrescription_patientId_idx` (`patientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Demo dental clinic (separate company; does not affect Elite/company 1)
INSERT INTO `Company` (`id`, `name`, `slug`, `isActive`, `isDemo`, `type`, `notes`, `createdAt`, `updatedAt`)
VALUES (3, 'عيادة الابتسامة لطب الأسنان', 'dental-demo', 1, 1, 'dental', 'عيادة تجريبية لنظام الأسنان', NOW(), NOW());

-- Demo dentist login (username: dental / password: dental1234). Password stored plain for quick test; upgraded to bcrypt on first login.
INSERT INTO `AppUser` (`username`, `password`, `role`, `isActive`, `companyId`, `createdAt`, `updatedAt`)
VALUES ('dental', 'dental1234', 'master', 1, 3, NOW(), NOW());

-- Sample patients
INSERT INTO `DentalPatient` (`companyId`, `patientNumber`, `fullName`, `phone`, `whatsapp`, `gender`, `birthDate`, `allergies`, `medicalHistory`, `createdAt`, `updatedAt`) VALUES
 (3, 'P-1001', 'أحمد محمود', '0599100200', '0599100200', 'ذكر', '1990-05-12', '["حساسية بنسلين"]', '["السكري"]', NOW(), NOW()),
 (3, 'P-1002', 'سارة خالد', '0598200300', '0598200300', 'أنثى', '1995-09-01', '[]', '[]', NOW(), NOW()),
 (3, 'P-1003', 'محمد علي', '0597300400', '0597300400', 'ذكر', '1988-01-20', '["Latex"]', '["ضغط الدم"]', NOW(), NOW());

-- Sample appointments today
INSERT INTO `DentalAppointment` (`companyId`, `patientId`, `doctorName`, `treatmentType`, `startAt`, `durationMin`, `room`, `status`, `createdAt`, `updatedAt`) VALUES
 (3, 1, 'د. ليلى', 'تنظيف', DATE_ADD(CURDATE(), INTERVAL 9 HOUR), 30, 'غرفة 1', 'arrived', NOW(), NOW()),
 (3, 2, 'د. ليلى', 'حشوة', DATE_ADD(CURDATE(), INTERVAL 10 HOUR), 45, 'غرفة 1', 'confirmed', NOW(), NOW()),
 (3, 3, 'د. سامي', 'علاج عصب', DATE_ADD(CURDATE(), INTERVAL 11 HOUR), 60, 'غرفة 2', 'scheduled', NOW(), NOW());

-- Sample tooth conditions for patient 1
INSERT INTO `DentalToothCondition` (`companyId`, `patientId`, `toothNumber`, `condition`, `updatedAt`) VALUES
 (3, 1, 26, 'root_canal', NOW()),
 (3, 1, 16, 'filling', NOW()),
 (3, 1, 36, 'caries', NOW());

-- Sample treatment plan for patient 1
INSERT INTO `DentalTreatmentPlan` (`id`, `companyId`, `patientId`, `title`, `discount`, `status`, `createdAt`, `updatedAt`)
VALUES (1, 3, 1, 'خطة علاج شاملة', 300, 'active', NOW(), NOW());
INSERT INTO `DentalTreatmentItem` (`planId`, `companyId`, `patientId`, `toothNumber`, `treatment`, `price`, `status`, `createdAt`) VALUES
 (1, 3, 1, 16, 'علاج عصب', 1500, 'completed', NOW()),
 (1, 3, 1, 16, 'تاج Crown', 2000, 'approved', NOW()),
 (1, 3, 1, 25, 'حشوة Composite', 500, 'proposed', NOW()),
 (1, 3, 1, 36, 'خلع', 600, 'proposed', NOW());

INSERT INTO `DentalPayment` (`companyId`, `patientId`, `amount`, `method`, `notes`, `createdAt`) VALUES
 (3, 1, 1500, 'cash', 'دفعة أولى', NOW());
