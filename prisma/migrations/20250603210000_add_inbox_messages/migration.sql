-- CreateTable InboundMessage
CREATE TABLE `InboundMessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `channel` VARCHAR(191) NOT NULL,
    `sender` VARCHAR(191) NOT NULL,
    `senderName` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `provider` VARCHAR(191) NULL,
    `providerId` VARCHAR(191) NULL,
    `customerId` INTEGER NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InboundMessage_channel_isRead_idx`(`channel`, `isRead`),
    INDEX `InboundMessage_customerId_idx`(`customerId`),
    INDEX `InboundMessage_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `InboundMessage_provider_providerId_key`(`provider`, `providerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add isRead to outbound for unified inbox read state
ALTER TABLE `OutboundMessage` ADD COLUMN `isRead` BOOLEAN NOT NULL DEFAULT true;
