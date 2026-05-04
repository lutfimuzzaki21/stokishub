/*
  Warnings:

  - You are about to drop the `scheduledorder` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `scheduledorder` DROP FOREIGN KEY `ScheduledOrder_consumerId_fkey`;

-- DropForeignKey
ALTER TABLE `scheduledorder` DROP FOREIGN KEY `ScheduledOrder_productId_fkey`;

-- DropForeignKey
ALTER TABLE `scheduledorder` DROP FOREIGN KEY `ScheduledOrder_stokisId_fkey`;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `sales_id` INTEGER NULL;

-- DropTable
DROP TABLE `scheduledorder`;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_sales_id_fkey` FOREIGN KEY (`sales_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
