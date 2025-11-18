-- CreateTable
CREATE TABLE "RegistrationStage" (
    "id" SERIAL NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "stageName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,

    CONSTRAINT "RegistrationStage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RegistrationStage" ADD CONSTRAINT "RegistrationStage_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
