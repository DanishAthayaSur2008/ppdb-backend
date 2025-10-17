/*
  Warnings:

  - The `status` column on the `Registration` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `progress` column on the `Registration` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `stage` column on the `Registration` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `selectionResult` column on the `Registration` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Registration" DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
DROP COLUMN "progress",
ADD COLUMN     "progress" TEXT DEFAULT 'DRAFT',
DROP COLUMN "stage",
ADD COLUMN     "stage" TEXT DEFAULT 'PENDAFTARAN',
DROP COLUMN "selectionResult",
ADD COLUMN     "selectionResult" TEXT;
