CREATE TABLE `AutomationRule` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `triggerType` VARCHAR(191) NOT NULL,
  `actionType` VARCHAR(191) NOT NULL,
  `config` TEXT NOT NULL,
  `isEnabled` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AutomationRule_name_key`(`name`),
  INDEX `AutomationRule_triggerType_isEnabled_idx`(`triggerType`, `isEnabled`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
