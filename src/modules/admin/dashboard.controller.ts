import { prisma } from "../../database/prisma";

export const adminDashboardController = async () => {
  // Total users
  const totalUsers = await prisma.user.count();

  // Form summary
  const pending = await prisma.form.count({ where: { status: "PENDING" } });
  const accepted = await prisma.form.count({ where: { status: "ACCEPTED" } });
  const rejected = await prisma.form.count({ where: { status: "REJECTED" } });

  // Workflow summary per stage
  const stages = [
    "SELEKSI_BERKAS",
    "TES_AKADEMIK",
    "WAWANCARA",
    "TES_PSIKOTEST",
    "HOME_VISIT",
    "PENGUMUMAN_FINAL"
  ] as const;

  const workflow: any = {};

  for (const stage of stages) {
    const passed = await prisma.workflowStage.count({
      where: { stage, status: "PASSED" }
    });

    const failed = await prisma.workflowStage.count({
      where: { stage, status: "FAILED" }
    });

    workflow[stage] = { passed, failed };
  }

  // Recent notifications
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 10
  });

  // Recent workflow changes — FIXED
const workflowHistory = await prisma.workflowHistory.findMany({
  orderBy: { timestamp: "desc" },
  take: 10
});


  return {
    summary: {
      totalUsers,
      forms: {
        pending,
        accepted,
        rejected
      },
      workflow
    },
    recentActivity: {
      notifications,
      workflowHistory
    }
  };
};
