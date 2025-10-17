/*
  Warnings:

  - The values [BERKAS,PSIKOTES,SELESAI] on the enum `SelectionStage` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "SelectionResult" AS ENUM ('LULUS', 'TIDAK_LULUS');

-- AlterEnum
BEGIN;
CREATE TYPE "SelectionStage_new" AS ENUM ('PENDAFTARAN', 'SELEKSI_BERKAS', 'TES_AKADEMIK', 'PSIKOTEST', 'WAWANCARA', 'PENGUMUMAN');
ALTER TABLE "public"."Registration" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "Registration" ALTER COLUMN "stage" TYPE "SelectionStage_new" USING ("stage"::text::"SelectionStage_new");
ALTER TYPE "SelectionStage" RENAME TO "SelectionStage_old";
ALTER TYPE "SelectionStage_new" RENAME TO "SelectionStage";
DROP TYPE "public"."SelectionStage_old";
ALTER TABLE "Registration" ALTER COLUMN "stage" SET DEFAULT 'PENDAFTARAN';
COMMIT;

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "selectionResult" "SelectionResult",
ALTER COLUMN "stage" SET DEFAULT 'PENDAFTARAN';
