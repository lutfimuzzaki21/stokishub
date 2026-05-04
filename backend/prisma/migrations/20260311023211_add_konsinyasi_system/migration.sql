-- AlterTable
ALTER TABLE `order` ADD COLUMN `isKonsinyasi` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `KonsinyasiContract` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stokisId` INTEGER NOT NULL,
    `konsumenId` INTEGER NOT NULL,
    `contractNo` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `billingCycle` VARCHAR(191) NOT NULL DEFAULT 'MONTHLY',
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `ownerName` VARCHAR(191) NOT NULL,
    `storeName` VARCHAR(191) NOT NULL,
    `storeAddress` VARCHAR(191) NOT NULL,
    `storePhone` VARCHAR(191) NULL,
    `idCardNo` VARCHAR(191) NULL,
    `npwpNo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KonsinyasiContract_contractNo_key`(`contractNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KonsinyasiItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `packagingId` INTEGER NULL,
    `priceKonsinyasi` DOUBLE NOT NULL,
    `maxQtyPerDelivery` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `KonsinyasiItem_contractId_productId_packagingId_key`(`contractId`, `productId`, `packagingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KonsinyasiSchedule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contractId` INTEGER NOT NULL,
    `deliveryDate` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SCHEDULED',
    `notes` VARCHAR(191) NULL,
    `orderId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `KonsinyasiSchedule_orderId_key`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KonsinyasiScheduleItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scheduleId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `packagingId` INTEGER NULL,
    `quantity` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KonsinyasiContract` ADD CONSTRAINT `KonsinyasiContract_stokisId_fkey` FOREIGN KEY (`stokisId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KonsinyasiContract` ADD CONSTRAINT `KonsinyasiContract_konsumenId_fkey` FOREIGN KEY (`konsumenId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KonsinyasiItem` ADD CONSTRAINT `KonsinyasiItem_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `KonsinyasiContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KonsinyasiItem` ADD CONSTRAINT `KonsinyasiItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KonsinyasiItem` ADD CONSTRAINT `KonsinyasiItem_packagingId_fkey` FOREIGN KEY (`packagingId`) REFERENCES `ProductPackaging`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KonsinyasiSchedule` ADD CONSTRAINT `KonsinyasiSchedule_contractId_fkey` FOREIGN KEY (`contractId`) REFERENCES `KonsinyasiContract`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KonsinyasiSchedule` ADD CONSTRAINT `KonsinyasiSchedule_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KonsinyasiScheduleItem` ADD CONSTRAINT `KonsinyasiScheduleItem_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `KonsinyasiSchedule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KonsinyasiScheduleItem` ADD CONSTRAINT `KonsinyasiScheduleItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KonsinyasiScheduleItem` ADD CONSTRAINT `KonsinyasiScheduleItem_packagingId_fkey` FOREIGN KEY (`packagingId`) REFERENCES `ProductPackaging`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
