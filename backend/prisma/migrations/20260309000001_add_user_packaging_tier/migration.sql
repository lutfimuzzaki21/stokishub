-- CreateTable
CREATE TABLE `UserPackagingTier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `packagingId` INTEGER NOT NULL,
    `level_name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `UserPackagingTier_userId_packagingId_key`(`userId`, `packagingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserPackagingTier` ADD CONSTRAINT `UserPackagingTier_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserPackagingTier` ADD CONSTRAINT `UserPackagingTier_packagingId_fkey` FOREIGN KEY (`packagingId`) REFERENCES `ProductPackaging`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
