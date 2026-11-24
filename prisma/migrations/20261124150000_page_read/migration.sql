-- Progression de lecture : « page lue » par utilisateur.
CREATE TABLE `PageRead` (
    `userId` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PageRead_pageId_idx`(`pageId`),
    INDEX `PageRead_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`userId`, `pageId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PageRead` ADD CONSTRAINT `PageRead_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `PageRead` ADD CONSTRAINT `PageRead_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `Page`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
