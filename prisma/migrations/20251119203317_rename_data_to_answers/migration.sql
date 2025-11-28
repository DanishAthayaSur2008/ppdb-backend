/*
  Warnings:

  - You are about to drop the column `data` on the `FormSection` table. All the data in the column will be lost.
  - Added the required column `answers` to the `FormSection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FormSection" DROP COLUMN "data",
ADD COLUMN     "answers" JSONB NOT NULL;
