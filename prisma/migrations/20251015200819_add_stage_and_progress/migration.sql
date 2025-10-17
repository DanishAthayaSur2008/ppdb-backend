-- CreateEnum
CREATE TYPE "SelectionStage" AS ENUM ('BERKAS', 'TES_AKADEMIK', 'PSIKOTES', 'WAWANCARA', 'PENGUMUMAN', 'SELESAI');

-- CreateEnum
CREATE TYPE "FormProgress" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED');

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "progress" "FormProgress" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "stage" "SelectionStage" NOT NULL DEFAULT 'BERKAS';
