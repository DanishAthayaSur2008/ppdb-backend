/*
  Warnings:

  - You are about to drop the column `note` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedAt` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `uploadedAt` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `verificationStatus` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the `StudentProfile` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `address` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `birthDate` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `birthPlace` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `city` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `familyStatus` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fullName` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gradYear` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `livingWith` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nik` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nisn` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `npsn` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `parentStatus` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `schoolOrigin` to the `Registration` table without a default value. This is not possible if the table is not empty.
  - Added the required column `siblingInfo` to the `Registration` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."DocStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "public"."Document" DROP CONSTRAINT "Document_registrationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Registration" DROP CONSTRAINT "Registration_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StudentProfile" DROP CONSTRAINT "StudentProfile_userId_fkey";

-- DropIndex
DROP INDEX "public"."Document_registrationId_idx";

-- AlterTable
ALTER TABLE "public"."Document" DROP COLUMN "note",
DROP COLUMN "reviewedAt",
DROP COLUMN "type",
DROP COLUMN "uploadedAt",
DROP COLUMN "verificationStatus",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "public"."DocStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "public"."Registration" ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "birthDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "birthPlace" TEXT NOT NULL,
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "familyStatus" TEXT NOT NULL,
ADD COLUMN     "fullName" TEXT NOT NULL,
ADD COLUMN     "gradYear" INTEGER NOT NULL,
ADD COLUMN     "livingWith" TEXT NOT NULL,
ADD COLUMN     "nik" TEXT NOT NULL,
ADD COLUMN     "nisn" TEXT NOT NULL,
ADD COLUMN     "npsn" TEXT NOT NULL,
ADD COLUMN     "parentStatus" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "schoolOrigin" TEXT NOT NULL,
ADD COLUMN     "siblingInfo" TEXT NOT NULL,
ADD COLUMN     "socialAid" TEXT,
ADD COLUMN     "socialMedia" TEXT;

-- DropTable
DROP TABLE "public"."StudentProfile";

-- DropEnum
DROP TYPE "public"."DocType";

-- DropEnum
DROP TYPE "public"."VerificationStatus";

-- CreateTable
CREATE TABLE "public"."Student" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "nisn" TEXT NOT NULL,
    "nik" TEXT NOT NULL,
    "birthPlace" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "address" TEXT NOT NULL,
    "province" TEXT,
    "city" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "schoolOrigin" TEXT NOT NULL,
    "npsn" TEXT NOT NULL,
    "gradYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Document" ADD CONSTRAINT "Document_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "public"."Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Document" ADD CONSTRAINT "Document_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Student" ADD CONSTRAINT "Student_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
