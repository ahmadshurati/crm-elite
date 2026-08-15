-- WhatsApp Cloud API integration (dental-scoped, additive)

-- Per-company connection config (secrets stored server-side; never returned to the client)
CREATE TABLE `DentalWhatsAppConfig` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `phoneNumberId` VARCHAR(191) NULL,
  `businessAccountId` VARCHAR(191) NULL,
  `verifyToken` VARCHAR(191) NULL,
  `accessToken` TEXT NULL,
  `appSecret` VARCHAR(255) NULL,
  `defaultCountry` VARCHAR(8) NOT NULL DEFAULT '972',
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdByUserId` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DentalWhatsAppConfig_companyId_key` (`companyId`),
  INDEX `DentalWhatsAppConfig_phoneNumberId_idx` (`phoneNumberId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalWhatsAppConversation` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `patientId` INT NULL,
  `phone` VARCHAR(32) NOT NULL,
  `waName` VARCHAR(191) NULL,
  `lastMessageText` VARCHAR(500) NULL,
  `lastMessageAt` DATETIME(3) NULL,
  `lastInboundAt` DATETIME(3) NULL,
  `unreadCount` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(20) NOT NULL DEFAULT 'open',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DentalWhatsAppConversation_company_phone_key` (`companyId`, `phone`),
  INDEX `DentalWhatsAppConversation_company_last_idx` (`companyId`, `lastMessageAt`),
  INDEX `DentalWhatsAppConversation_patientId_idx` (`patientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DentalWhatsAppMessage` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `companyId` INT NOT NULL,
  `conversationId` INT NOT NULL,
  `patientId` INT NULL,
  `wamid` VARCHAR(191) NULL,
  `direction` VARCHAR(10) NOT NULL,
  `type` VARCHAR(20) NOT NULL DEFAULT 'text',
  `body` TEXT NULL,
  `mediaUrl` VARCHAR(1000) NULL,
  `templateName` VARCHAR(191) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `errorCode` VARCHAR(64) NULL,
  `errorMessage` VARCHAR(500) NULL,
  `contextWamid` VARCHAR(191) NULL,
  `sentByUserId` INT NULL,
  `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `DentalWhatsAppMessage_wamid_key` (`wamid`),
  INDEX `DentalWhatsAppMessage_conversation_idx` (`conversationId`, `timestamp`),
  INDEX `DentalWhatsAppMessage_company_idx` (`companyId`),
  INDEX `DentalWhatsAppMessage_patientId_idx` (`patientId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
