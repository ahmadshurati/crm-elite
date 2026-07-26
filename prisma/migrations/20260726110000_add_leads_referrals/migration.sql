-- Public lead capture + shop referral tracking (additive)

CREATE TABLE `ReferralShop` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `ownerName` VARCHAR(191) NULL,
  `contactPhone` VARCHAR(191) NULL,
  `commissionAmount` DOUBLE NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ReferralShop_code_key` (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Lead` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NULL,
  `businessName` VARCHAR(191) NULL,
  `note` TEXT NULL,
  `shopCode` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'new',
  `ipAddress` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Lead_shopCode_idx` (`shopCode`),
  INDEX `Lead_status_idx` (`status`),
  INDEX `Lead_createdAt_idx` (`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ScanEvent` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `shopCode` VARCHAR(191) NULL,
  `ipAddress` VARCHAR(191) NULL,
  `userAgent` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ScanEvent_shopCode_idx` (`shopCode`),
  INDEX `ScanEvent_createdAt_idx` (`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Sample shop so the QR/dashboard links work immediately
INSERT INTO `ReferralShop` (`code`, `name`, `ownerName`, `commissionAmount`, `isActive`)
VALUES ('demo-shop', 'محل تجريبي', 'صاحب المحل', 25, true);
