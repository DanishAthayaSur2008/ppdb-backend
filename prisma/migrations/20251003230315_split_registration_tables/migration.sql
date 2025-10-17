/*
  Warnings:

  - You are about to drop the column `address` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `birthDate` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `birthPlace` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `city` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `familyStatus` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `fullName` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `gradYear` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `livingWith` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `nik` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `nisn` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `npsn` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `parentStatus` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `province` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `schoolOrigin` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `siblingInfo` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `socialAid` on the `Registration` table. All the data in the column will be lost.
  - You are about to drop the column `socialMedia` on the `Registration` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Registration" DROP COLUMN "address",
DROP COLUMN "birthDate",
DROP COLUMN "birthPlace",
DROP COLUMN "city",
DROP COLUMN "familyStatus",
DROP COLUMN "fullName",
DROP COLUMN "gradYear",
DROP COLUMN "livingWith",
DROP COLUMN "nik",
DROP COLUMN "nisn",
DROP COLUMN "npsn",
DROP COLUMN "parentStatus",
DROP COLUMN "phone",
DROP COLUMN "province",
DROP COLUMN "schoolOrigin",
DROP COLUMN "siblingInfo",
DROP COLUMN "socialAid",
DROP COLUMN "socialMedia";

-- CreateTable
CREATE TABLE "public"."ParticipantData" (
    "id" SERIAL NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "nisn" TEXT NOT NULL,
    "nik" TEXT NOT NULL,
    "birthPlace" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "address" TEXT NOT NULL,
    "province" TEXT,
    "city" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "socialMedia" TEXT,
    "schoolOrigin" TEXT NOT NULL,
    "npsn" TEXT NOT NULL,
    "gradYear" INTEGER NOT NULL,
    "siblingInfo" TEXT NOT NULL,
    "parentStatus" TEXT NOT NULL,
    "familyStatus" TEXT NOT NULL,
    "livingWith" TEXT NOT NULL,
    "socialAid" TEXT,

    CONSTRAINT "ParticipantData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AchievementData" (
    "id" SERIAL NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "mathSemester3" DOUBLE PRECISION,
    "mathSemester4" DOUBLE PRECISION,
    "mathSemester5" DOUBLE PRECISION,
    "bahasaSemester3" DOUBLE PRECISION,
    "bahasaSemester4" DOUBLE PRECISION,
    "bahasaSemester5" DOUBLE PRECISION,
    "englishSemester3" DOUBLE PRECISION,
    "englishSemester4" DOUBLE PRECISION,
    "englishSemester5" DOUBLE PRECISION,
    "ipaSemester3" DOUBLE PRECISION,
    "ipaSemester4" DOUBLE PRECISION,
    "ipaSemester5" DOUBLE PRECISION,
    "ipsSemester3" DOUBLE PRECISION,
    "ipsSemester4" DOUBLE PRECISION,
    "ipsSemester5" DOUBLE PRECISION,
    "foreignLang" TEXT,
    "hafalan" TEXT,
    "achievements" TEXT,
    "organizations" TEXT,
    "dream" TEXT,
    "hobby" TEXT,
    "uniqueness" TEXT,

    CONSTRAINT "AchievementData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ParentData" (
    "id" SERIAL NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "fatherName" TEXT NOT NULL,
    "fatherEducation" TEXT,
    "fatherPhone" TEXT,
    "fatherJob" TEXT,
    "fatherWorkplace" TEXT,
    "motherName" TEXT NOT NULL,
    "motherEducation" TEXT,
    "motherPhone" TEXT,
    "motherJob" TEXT,
    "motherWorkplace" TEXT,
    "guardianName" TEXT,
    "guardianAddress" TEXT,
    "guardianJob" TEXT,
    "guardianRelation" TEXT,
    "guardianEmail" TEXT,
    "dependents" INTEGER,
    "hopes" TEXT,

    CONSTRAINT "ParentData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantData_registrationId_key" ON "public"."ParticipantData"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementData_registrationId_key" ON "public"."AchievementData"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentData_registrationId_key" ON "public"."ParentData"("registrationId");

-- AddForeignKey
ALTER TABLE "public"."ParticipantData" ADD CONSTRAINT "ParticipantData_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "public"."Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AchievementData" ADD CONSTRAINT "AchievementData_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "public"."Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ParentData" ADD CONSTRAINT "ParentData_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "public"."Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
