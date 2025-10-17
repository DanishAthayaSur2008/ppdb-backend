/*
  Warnings:

  - You are about to drop the column `registrationId` on the `Notification` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Notification" DROP CONSTRAINT "Notification_registrationId_fkey";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "registrationId";
