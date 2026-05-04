-- CreateTable
CREATE TABLE `ProductPackaging` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `unitQty` INTEGER NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PackagingPriceTier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `packagingId` INTEGER NOT NULL,
    `level_name` VARCHAR(191) NOT NULL,
    `price` DOUBLE NOT NULL,
    `commission` DOUBLE NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `OrderItem` ADD COLUMN `packagingId` INTEGER NULL,
    ADD COLUMN `unitQty` INTEGER NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE `ProductPackaging` ADD CONSTRAINT `ProductPackaging_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackagingPriceTier` ADD CONSTRAINT `PackagingPriceTier_packagingId_fkey` FOREIGN KEY (`packagingId`) REFERENCES `ProductPackaging`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_packagingId_fkey` FOREIGN KEY (`packagingId`) REFERENCES `ProductPackaging`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
