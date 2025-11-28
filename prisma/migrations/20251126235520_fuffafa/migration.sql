/*
  Warnings:

  - You are about to drop the column `resetToken` on the `Form` table. All the data in the column will be lost.
  - You are about to drop the column `resetTokenExpires` on the `Form` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Form" DROP COLUMN "resetToken",
DROP COLUMN "resetTokenExpires";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpires" TIMESTAMP(3);
