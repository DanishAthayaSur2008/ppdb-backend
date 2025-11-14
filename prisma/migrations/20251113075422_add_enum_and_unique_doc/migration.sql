/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `uploadedAt` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `verified` on the `Document` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[registrationId,docType]` on the table `Document` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `docType` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileName` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalName` to the `Document` table without a default value. This is not possible if the table is not empty.
  - Added the required column `size` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('RAPORT', 'SKTM', 'FOLLOW_IG', 'VIDEO_REELS', 'SURAT_REKOMENDASI', 'AKTE_KELAHIRAN', 'KARTU_KELUARGA', 'PAS_FOTO', 'BPJS_KIS', 'KIP', 'FOTO_RUMAH_TAMPAK', 'FOTO_KAMAR_TIDUR', 'FOTO_DAPUR_KAMAR_MANDI');

-- DropIndex
DROP INDEX "Document_registrationId_type_key";

-- AlterTable
ALTER TABLE "Document" DROP COLUMN "fileUrl",
DROP COLUMN "type",
DROP COLUMN "uploadedAt",
DROP COLUMN "verified",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "docType" "DocType" NOT NULL,
ADD COLUMN     "fileName" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "originalName" TEXT NOT NULL,
ADD COLUMN     "size" INTEGER NOT NULL,
ADD COLUMN     "status" "DocStatus" NOT NULL DEFAULT 'PENDING';

-- DropEnum
DROP TYPE "DocumentType";

-- CreateIndex
CREATE UNIQUE INDEX "Document_registrationId_docType_key" ON "Document"("registrationId", "docType");
