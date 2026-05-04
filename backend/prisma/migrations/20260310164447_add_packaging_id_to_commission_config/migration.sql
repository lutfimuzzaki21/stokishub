-- AlterTable
ALTER TABLE `commissionconfig` ADD COLUMN `packagingId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `CommissionConfig_stokisId_salesId_productId_packagingId_idx` ON `CommissionConfig`(`stokisId`, `salesId`, `productId`, `packagingId`);

-- DropIndex
DROP INDEX `CommissionConfig_stokisId_salesId_productId_idx` ON `commissionconfig`;

-- AddForeignKey
ALTER TABLE `CommissionConfig` ADD CONSTRAINT `CommissionConfig_packagingId_fkey` FOREIGN KEY (`packagingId`) REFERENCES `ProductPackaging`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
