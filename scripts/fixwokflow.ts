import { prisma } from "../src/database/prisma";
import { Stage, StageStatus } from "@prisma/client";

async function ensureWorkflow(userId: string) {
  // Pastikan userId valid
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    console.error(`❌ User not found: ${userId}`);
    return;
  }

  console.log(`🔍 Creating workflow stages for user: ${user.email}`);

  const stages: Stage[] = [
    Stage.SELEKSI_BERKAS,
    Stage.TES_AKADEMIK,
    Stage.WAWANCARA,
    Stage.TES_PSIKOTEST,
    Stage.HOME_VISIT,
    Stage.PENGUMUMAN_FINAL
  ];

  for (const stage of stages) {
    await prisma.workflowStage.upsert({
      where: { userId_stage: { userId, stage } },
      update: {}, // don't update existing
      create: {
        userId,
        stage,
        status: StageStatus.PENDING
      }
    });
  }

  console.log("✅ Workflow ensured for:", userId);
}

async function main() {
  const USER_ID = "82f9f525-dcc1-4528-ab02-7a3da79e63d4"; // Ganti dengan USER_ID yang diinginkan

  if (USER_ID.includes("<")) {
    console.error("❌ Please insert a valid USER_ID before running this script.");
    process.exit(1);
  }

  await ensureWorkflow(USER_ID);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
