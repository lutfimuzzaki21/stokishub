-- Disable FK checks to allow dropping the unique index
SET FOREIGN_KEY_CHECKS = 0;

-- DropIndex
DROP INDEX `CommissionConfig_stokisId_productId_key` ON `commissionconfig`;

SET FOREIGN_KEY_CHECKS = 1;

-- AlterTable
ALTER TABLE `commissioncampaign` ADD COLUMN `salesId` INTEGER NULL;

-- AlterTable
ALTER TABLE `commissionconfig` ADD COLUMN `salesId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `CommissionConfig_stokisId_salesId_productId_idx` ON `CommissionConfig`(`stokisId`, `salesId`, `productId`);

-- AddForeignKey
ALTER TABLE `CommissionConfig` ADD CONSTRAINT `CommissionConfig_salesId_fkey` FOREIGN KEY (`salesId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommissionCampaign` ADD CONSTRAINT `CommissionCampaign_salesId_fkey` FOREIGN KEY (`salesId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
