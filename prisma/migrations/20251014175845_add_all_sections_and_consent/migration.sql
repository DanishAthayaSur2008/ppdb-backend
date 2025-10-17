/*
  Warnings:

  - The values [NEEDS_REVISION] on the enum `DocStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `bahasaSemester3` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `bahasaSemester4` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `bahasaSemester5` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `englishSemester3` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `englishSemester4` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `englishSemester5` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `ipaSemester3` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `ipaSemester4` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `ipaSemester5` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `ipsSemester3` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `ipsSemester4` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `ipsSemester5` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `mathSemester3` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `mathSemester4` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `mathSemester5` on the `AchievementData` table. All the data in the column will be lost.
  - You are about to drop the column `action` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `details` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `adminNote` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `dependents` on the `ParentData` table. All the data in the column will be lost.
  - You are about to drop the column `fatherEducation` on the `ParentData` table. All the data in the column will be lost.
  - You are about to drop the column `fatherWorkplace` on the `ParentData` table. All the data in the column will be lost.
  - You are about to drop the column `hopes` on the `ParentData` table. All the data in the column will be lost.
  - You are about to drop the column `motherEducation` on the `ParentData` table. All the data in the column will be lost.
  - You are about to drop the column `motherWorkplace` on the `ParentData` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `ParticipantData` table. All the data in the column will be lost.
  - You are about to drop the column `parentStatus` on the `ParticipantData` table. All the data in the column will be lost.
  - You are about to drop the column `province` on the `ParticipantData` table. All the data in the column will be lost.
  - You are about to drop the column `schoolOrigin` on the `ParticipantData` table. All the data in the column will be lost.
  - You are about to drop the column `siblingInfo` on the `ParticipantData` table. All the data in the column will be lost.
  - Added the required column `ip` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `method` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `path` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userAgent` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `documentType` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `childOrder` to the `ParticipantData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `parentCondition` to the `ParticipantData` table without a default value. This is not possible if the table is not empty.
  - Added the required column `schoolName` to the `ParticipantData` table without a default value. This is not possible if the table is not empty.
  - Made the column `socialAid` on table `ParticipantData` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DocStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "public"."Document" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Document" ALTER COLUMN "status" TYPE "DocStatus_new" USING ("status"::text::"DocStatus_new");
ALTER TYPE "DocStatus" RENAME TO "DocStatus_old";
ALTER TYPE "DocStatus_new" RENAME TO "DocStatus";
DROP TYPE "public"."DocStatus_old";
ALTER TABLE "Document" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- AlterTable
ALTER TABLE "AchievementData" DROP COLUMN "bahasaSemester3",
DROP COLUMN "bahasaSemester4",
DROP COLUMN "bahasaSemester5",
DROP COLUMN "englishSemester3",
DROP COLUMN "englishSemester4",
DROP COLUMN "englishSemester5",
DROP COLUMN "ipaSemester3",
DROP COLUMN "ipaSemester4",
DROP COLUMN "ipaSemester5",
DROP COLUMN "ipsSemester3",
DROP COLUMN "ipsSemester4",
DROP COLUMN "ipsSemester5",
DROP COLUMN "mathSemester3",
DROP COLUMN "mathSemester4",
DROP COLUMN "mathSemester5",
ADD COLUMN     "english3" DOUBLE PRECISION,
ADD COLUMN     "english4" DOUBLE PRECISION,
ADD COLUMN     "english5" DOUBLE PRECISION,
ADD COLUMN     "indo3" DOUBLE PRECISION,
ADD COLUMN     "indo4" DOUBLE PRECISION,
ADD COLUMN     "indo5" DOUBLE PRECISION,
ADD COLUMN     "ipa3" DOUBLE PRECISION,
ADD COLUMN     "ipa4" DOUBLE PRECISION,
ADD COLUMN     "ipa5" DOUBLE PRECISION,
ADD COLUMN     "ips3" DOUBLE PRECISION,
ADD COLUMN     "ips4" DOUBLE PRECISION,
ADD COLUMN     "ips5" DOUBLE PRECISION,
ADD COLUMN     "math3" DOUBLE PRECISION,
ADD COLUMN     "math4" DOUBLE PRECISION,
ADD COLUMN     "math5" DOUBLE PRECISION,
ADD COLUMN     "pai3" DOUBLE PRECISION,
ADD COLUMN     "pai4" DOUBLE PRECISION,
ADD COLUMN     "pai5" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "action",
DROP COLUMN "createdAt",
DROP COLUMN "details",
DROP COLUMN "userId",
ADD COLUMN     "ip" TEXT NOT NULL,
ADD COLUMN     "method" TEXT NOT NULL,
ADD COLUMN     "path" TEXT NOT NULL,
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "userAgent" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "adminNote",
ADD COLUMN     "documentType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ParentData" DROP COLUMN "dependents",
DROP COLUMN "fatherEducation",
DROP COLUMN "fatherWorkplace",
DROP COLUMN "hopes",
DROP COLUMN "motherEducation",
DROP COLUMN "motherWorkplace",
ADD COLUMN     "fatherAddress" TEXT,
ADD COLUMN     "fatherDependents" INTEGER,
ADD COLUMN     "fatherEdu" TEXT,
ADD COLUMN     "fatherHope" TEXT,
ADD COLUMN     "fatherWorkAddress" TEXT,
ADD COLUMN     "guardianDependents" INTEGER,
ADD COLUMN     "hasScholarSibling" BOOLEAN,
ADD COLUMN     "incomeSource" TEXT,
ADD COLUMN     "motherAddress" TEXT,
ADD COLUMN     "motherDependents" INTEGER,
ADD COLUMN     "motherEdu" TEXT,
ADD COLUMN     "motherHope" TEXT,
ADD COLUMN     "motherWorkAddress" TEXT,
ADD COLUMN     "relativeEmail" TEXT,
ADD COLUMN     "relativeName" TEXT,
ADD COLUMN     "relativePhone" TEXT,
ADD COLUMN     "relativeRelation" TEXT,
ADD COLUMN     "sourceInfo" TEXT;

-- AlterTable
ALTER TABLE "ParticipantData" DROP COLUMN "city",
DROP COLUMN "parentStatus",
DROP COLUMN "province",
DROP COLUMN "schoolOrigin",
DROP COLUMN "siblingInfo",
ADD COLUMN     "childOrder" TEXT NOT NULL,
ADD COLUMN     "parentCondition" TEXT NOT NULL,
ADD COLUMN     "schoolName" TEXT NOT NULL,
ALTER COLUMN "socialAid" SET NOT NULL;

-- CreateTable
CREATE TABLE "HousingData" (
    "id" SERIAL NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "yearAcquired" INTEGER,
    "landArea" DOUBLE PRECISION,
    "ownershipStatus" TEXT,
    "houseCondition" TEXT,
    "vehicle" TEXT,
    "property" TEXT,
    "vehicleOwnership" TEXT,
    "propertyOwnership" TEXT,
    "electricity" TEXT,
    "waterSource" TEXT,

    CONSTRAINT "HousingData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthData" (
    "id" SERIAL NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "infectiousDiseases" TEXT,
    "allergies" TEXT,
    "underTreatment" BOOLEAN,
    "bloodType" TEXT,
    "colorBlind" BOOLEAN,
    "smoker" BOOLEAN,

    CONSTRAINT "HealthData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentData" (
    "id" SERIAL NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "statement1" BOOLEAN NOT NULL,
    "statement2" BOOLEAN NOT NULL,
    "statement3" BOOLEAN NOT NULL,

    CONSTRAINT "ConsentData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HousingData_registrationId_key" ON "HousingData"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthData_registrationId_key" ON "HealthData"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentData_registrationId_key" ON "ConsentData"("registrationId");

-- AddForeignKey
ALTER TABLE "HousingData" ADD CONSTRAINT "HousingData_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthData" ADD CONSTRAINT "HealthData_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentData" ADD CONSTRAINT "ConsentData_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
