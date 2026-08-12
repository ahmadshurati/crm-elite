-- Treatment catalog, sessions, richer plan items (additive)

CREATE TABLE `DentalTreatmentCatalog` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL DEFAULT 'general',
  `defaultPriceCents` INT NOT NULL DEFAULT 0,
  `estimatedDurationMin` INT NOT NULL DEFAULT 30,
  `requiresTooth` BOOLEAN NOT NULL DEFAULT false,
  `requiresSurface` BOOLEAN NOT NULL DEFAULT false,
  `requiresLab` BOOLEAN NOT NULL DEFAULT false,
  `expectedSessions` INT NOT NULL DEFAULT 1,
  `chartCondition` VARCHAR(191) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DentalTreatmentCatalog_company_code_key` (`companyId`, `code`),
  INDEX `DentalTreatmentCatalog_companyId_idx` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalTreatmentSession` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `itemId` INT NOT NULL,
  `sessionNumber` INT NOT NULL DEFAULT 1,
  `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `doctorName` VARCHAR(191) NULL,
  `visitId` INT NULL,
  `procedures` TEXT NULL,
  `notes` TEXT NULL,
  `nextSessionRecommendation` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'completed',
  `createdByUserId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalTreatmentSession_itemId_idx` (`itemId`),
  INDEX `DentalTreatmentSession_patientId_idx` (`patientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DentalTreatmentItem` ADD COLUMN `catalogId` INT NULL;
ALTER TABLE `DentalTreatmentItem` ADD COLUMN `acceptedAt` DATETIME(3) NULL;
ALTER TABLE `DentalTreatmentItem` ADD COLUMN `completedAt` DATETIME(3) NULL;
ALTER TABLE `DentalTreatmentItem` ADD COLUMN `itemNotes` TEXT NULL;

-- Standardize statuses on the spec set
UPDATE `DentalTreatmentItem` SET `status` = 'accepted' WHERE `status` = 'approved';

ALTER TABLE `DentalTreatmentPlan` ADD COLUMN `insuranceCents` INT NOT NULL DEFAULT 0;

-- Seed a treatment catalog for the demo clinic (company 3)
INSERT INTO `DentalTreatmentCatalog`
  (`companyId`, `code`, `name`, `category`, `defaultPriceCents`, `estimatedDurationMin`, `requiresTooth`, `requiresSurface`, `requiresLab`, `expectedSessions`, `chartCondition`, `active`)
VALUES
  (3, 'CONSULT', 'استشارة', 'general', 5000, 15, 0, 0, 0, 1, NULL, 1),
  (3, 'CLEANING', 'تنظيف الأسنان', 'preventive', 15000, 30, 0, 0, 0, 1, NULL, 1),
  (3, 'SCALING', 'تقليح', 'periodontics', 20000, 30, 0, 0, 0, 1, NULL, 1),
  (3, 'COMPOSITE', 'حشوة كمبوزيت', 'restorative', 50000, 30, 1, 1, 0, 1, 'filling', 1),
  (3, 'ROOT_CANAL', 'علاج عصب', 'endodontics', 150000, 60, 1, 0, 0, 3, 'root_canal', 1),
  (3, 'EXTRACTION', 'خلع', 'surgery', 60000, 30, 1, 0, 0, 1, 'extracted', 1),
  (3, 'SURG_EXTRACTION', 'خلع جراحي', 'surgery', 120000, 45, 1, 0, 0, 1, 'extracted', 1),
  (3, 'CROWN', 'تاج', 'prosthetics', 200000, 45, 1, 0, 1, 2, 'crown', 1),
  (3, 'BRIDGE', 'جسر', 'prosthetics', 500000, 60, 0, 0, 1, 3, 'bridge', 1),
  (3, 'IMPLANT', 'زرعة سنية', 'surgery', 400000, 90, 1, 0, 1, 3, 'implant', 1),
  (3, 'WHITENING', 'تبييض', 'cosmetic', 80000, 60, 0, 0, 0, 1, NULL, 1),
  (3, 'PERIO', 'علاج لثة', 'periodontics', 100000, 45, 0, 0, 0, 2, 'gum_issue', 1),
  (3, 'ORTHO', 'تقويم أسنان', 'orthodontics', 1000000, 30, 0, 0, 0, 1, NULL, 1);

-- Link existing demo plan items to catalog where the treatment name matches loosely
UPDATE `DentalTreatmentItem` i
  JOIN `DentalTreatmentCatalog` c ON c.companyId = i.companyId AND c.code = 'ROOT_CANAL'
  SET i.catalogId = c.id WHERE i.companyId = 3 AND i.treatment LIKE '%عصب%';
UPDATE `DentalTreatmentItem` i
  JOIN `DentalTreatmentCatalog` c ON c.companyId = i.companyId AND c.code = 'CROWN'
  SET i.catalogId = c.id WHERE i.companyId = 3 AND i.treatment LIKE '%تاج%';
UPDATE `DentalTreatmentItem` i
  JOIN `DentalTreatmentCatalog` c ON c.companyId = i.companyId AND c.code = 'COMPOSITE'
  SET i.catalogId = c.id WHERE i.companyId = 3 AND i.treatment LIKE '%Composite%';
UPDATE `DentalTreatmentItem` i
  JOIN `DentalTreatmentCatalog` c ON c.companyId = i.companyId AND c.code = 'EXTRACTION'
  SET i.catalogId = c.id WHERE i.companyId = 3 AND i.treatment LIKE '%خلع%';
