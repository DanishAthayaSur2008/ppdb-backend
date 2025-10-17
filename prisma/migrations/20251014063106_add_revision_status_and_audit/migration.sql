/*
  Warnings:

  - The values [REJECTED] on the enum `DocStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [REVISION_REQUIRED] on the enum `RegStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `lastSavedAt` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `ip` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `method` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `path` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `timestamp` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `lastSavedAt` on the `ParentData` table. All the data in the column will be lost.
  - You are about to drop the column `lastSavedAt` on the `ParticipantData` table. All the data in the column will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `action` to the `AuditLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DocStatus_new" AS ENUM ('PENDING', 'NEEDS_REVISION', 'APPROVED');
ALTER TABLE "public"."Document" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Document" ALTER COLUMN "status" TYPE "DocStatus_new" USING ("status"::text::"DocStatus_new");
ALTER TYPE "DocStatus" RENAME TO "DocStatus_old";
ALTER TYPE "DocStatus_new" RENAME TO "DocStatus";
DROP TYPE "public"."DocStatus_old";
ALTER TABLE "Document" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "RegStatus_new" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
ALTER TABLE "public"."Registration" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Registration" ALTER COLUMN "status" TYPE "RegStatus_new" USING ("status"::text::"RegStatus_new");
ALTER TYPE "RegStatus" RENAME TO "RegStatus_old";
ALTER TYPE "RegStatus_new" RENAME TO "RegStatus";
DROP TYPE "public"."RegStatus_old";
ALTER TABLE "Registration" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- AlterTable
ALTER TABLE "AchievementData" DROP COLUMN "lastSavedAt";

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "ip",
DROP COLUMN "method",
DROP COLUMN "path",
DROP COLUMN "timestamp",
DROP COLUMN "userAgent",
ADD COLUMN     "action" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "details" TEXT,
ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "adminNote" TEXT;

-- AlterTable
ALTER TABLE "ParentData" DROP COLUMN "lastSavedAt";

-- AlterTable
ALTER TABLE "ParticipantData" DROP COLUMN "lastSavedAt";

-- DropTable
DROP TABLE "public"."Notification";

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
