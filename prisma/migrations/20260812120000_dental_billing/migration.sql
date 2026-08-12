-- Billing engine: ledger adjustments, installments, invoices (additive)

ALTER TABLE `DentalPayment` ADD COLUMN `reference` VARCHAR(191) NULL;
ALTER TABLE `DentalPayment` ADD COLUMN `invoiceId` INT NULL;

CREATE TABLE `DentalLedgerEntry` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `amountCents` INT NOT NULL,
  `reason` VARCHAR(255) NULL,
  `createdByUserId` INT NULL,
  `voidedAt` DATETIME(3) NULL,
  `voidReason` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalLedgerEntry_patientId_idx` (`patientId`),
  INDEX `DentalLedgerEntry_companyId_idx` (`companyId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalInstallment` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `dueDate` DATE NOT NULL,
  `amountCents` INT NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'upcoming',
  `paidAt` DATETIME(3) NULL,
  `note` VARCHAR(255) NULL,
  `createdByUserId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `DentalInstallment_patientId_idx` (`patientId`),
  INDEX `DentalInstallment_company_due_idx` (`companyId`, `dueDate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalInvoice` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NOT NULL,
  `number` VARCHAR(191) NOT NULL,
  `type` VARCHAR(191) NOT NULL DEFAULT 'invoice',
  `items` TEXT NULL,
  `subtotalCents` INT NOT NULL DEFAULT 0,
  `discountCents` INT NOT NULL DEFAULT 0,
  `taxCents` INT NOT NULL DEFAULT 0,
  `totalCents` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(191) NOT NULL DEFAULT 'issued',
  `notes` VARCHAR(500) NULL,
  `createdByUserId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DentalInvoice_company_number_key` (`companyId`, `number`),
  INDEX `DentalInvoice_patientId_idx` (`patientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
