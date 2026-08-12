-- Labs, Inventory & Recall (additive)

CREATE TABLE `DentalLabOrder` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `doctorName` VARCHAR(191) NULL,
  `toothNumber` INT NULL,
  `labName` VARCHAR(191) NOT NULL,
  `workType` VARCHAR(191) NOT NULL DEFAULT 'crown',
  `shade` VARCHAR(191) NULL,
  `sentDate` DATE NULL,
  `expectedDate` DATE NULL,
  `costCents` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ordered',
  `notes` VARCHAR(500) NULL,
  `createdByUserId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalLabOrder_company_status_idx` (`companyId`, `status`),
  INDEX `DentalLabOrder_patientId_idx` (`patientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalInventoryItem` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `sku` VARCHAR(191) NULL,
  `brand` VARCHAR(191) NULL,
  `quantity` INT NOT NULL DEFAULT 0,
  `minQuantity` INT NOT NULL DEFAULT 0,
  `purchasePriceCents` INT NOT NULL DEFAULT 0,
  `supplier` VARCHAR(191) NULL,
  `batchNumber` VARCHAR(191) NULL,
  `expiryDate` DATE NULL,
  `createdByUserId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalInventoryItem_companyId_idx` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalRecall` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `type` VARCHAR(191) NOT NULL DEFAULT 'checkup',
  `dueDate` DATE NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'upcoming',
  `assignedTo` VARCHAR(191) NULL,
  `lastContact` DATE NULL,
  `nextAction` VARCHAR(255) NULL,
  `note` VARCHAR(500) NULL,
  `createdByUserId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalRecall_company_due_idx` (`companyId`, `dueDate`),
  INDEX `DentalRecall_patientId_idx` (`patientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Demo seed for clinic (company 3)
INSERT INTO `DentalInventoryItem` (`companyId`, `name`, `sku`, `brand`, `quantity`, `minQuantity`, `purchasePriceCents`, `supplier`, `expiryDate`)
VALUES
  (3, 'كمبوزيت A2', 'CMP-A2', '3M', 8, 5, 12000, 'Dental Supplies Co', '2027-06-01'),
  (3, 'مخدر ليدوكايين', 'ANS-LID', 'Septodont', 3, 6, 4500, 'Medico', '2026-12-01'),
  (3, 'قفازات (علبة)', 'GLV-M', 'MediGlove', 20, 10, 3000, 'Medico', NULL),
  (3, 'كمامات (علبة)', 'MSK-50', 'SafeMask', 4, 8, 2500, 'Medico', NULL);

INSERT INTO `DentalRecall` (`companyId`, `patientId`, `type`, `dueDate`, `status`, `nextAction`)
VALUES
  (3, 1, 'cleaning', DATE_ADD(CURDATE(), INTERVAL 3 DAY), 'upcoming', 'اتصال لتحديد موعد تنظيف'),
  (3, 1, 'checkup', DATE_SUB(CURDATE(), INTERVAL 2 DAY), 'upcoming', 'فحص دوري متأخر');

INSERT INTO `DentalLabOrder` (`companyId`, `patientId`, `doctorName`, `toothNumber`, `labName`, `workType`, `shade`, `sentDate`, `expectedDate`, `costCents`, `status`)
VALUES
  (3, 1, 'د. أحمد', 26, 'مختبر الابتسامة', 'crown', 'A2', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY), 80000, 'in_production');
