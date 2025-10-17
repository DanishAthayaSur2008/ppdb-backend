-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "verifiedBy" INTEGER;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
