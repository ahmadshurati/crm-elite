-- CreateTable FieldChangeLog
CREATE TABLE `FieldChangeLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `username` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` INTEGER NOT NULL,
    `fieldName` VARCHAR(191) NOT NULL,
    `oldValue` TEXT NULL,
    `newValue` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FieldChangeLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `FieldChangeLog_createdAt_idx`(`createdAt`),
    INDEX `FieldChangeLog_module_idx`(`module`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable CrmFile
CREATE TABLE `CrmFile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `customerId` INTEGER NULL,
    `folder` VARCHAR(191) NOT NULL DEFAULT 'general',
    `fileName` VARCHAR(191) NOT NULL,
    `fileUrl` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `uploadedByUserId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CrmFile_customerId_idx`(`customerId`),
    INDEX `CrmFile_folder_idx`(`folder`),
    INDEX `CrmFile_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey CrmFile
ALTER TABLE `CrmFile` ADD CONSTRAINT `CrmFile_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `CrmFile` ADD CONSTRAINT `CrmFile_uploadedByUserId_fkey` FOREIGN KEY (`uploadedByUserId`) REFERENCES `AppUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
