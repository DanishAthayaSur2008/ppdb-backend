import { prisma } from "../../database/prisma";
import { Stage, StageStatus, NotificationType } from "@prisma/client";

export const workflowService = {

  // ============================
  // GET STATUS WORKFLOW USER
  // ============================
  async getUserWorkflow(userId: string) {
    const stages = await prisma.workflowStage.findMany({
      where: { userId },
      orderBy: { stage: "asc" }
    });

    return stages.map(s => ({
      stage: s.stage,
      status: s.status,
      updatedAt: s.updatedAt
    }));
  },


  // ============================
  // UPDATE STATUS WORKFLOW
  // ============================
  async updateStage(
    userId: string,
    stage: Stage,
    status: StageStatus,       // PASSED | FAILED
    confirm: boolean,
    adminId: string
  ) {

    // Jika FAIL → harus confirm
    if (status === StageStatus.FAILED && !confirm) {
      return { error: "FAIL_REQUIRES_CONFIRMATION" };
    }

    const stageRecord = await prisma.workflowStage.findUnique({
      where: {
        userId_stage: { userId, stage }
      }
    });

    if (!stageRecord) return { error: "STAGE_NOT_FOUND" };

    // Tidak boleh ubah jika sudah final
    if (stageRecord.status === StageStatus.PASSED)
      return { error: "CANNOT_MODIFY_PASSED_STAGE" };

    if (stageRecord.status === StageStatus.FAILED)
      return { error: "CANNOT_MODIFY_FAILED_STAGE" };


    // ============================
    // VALIDASI URUTAN TAHAPAN
    // ============================

    const STAGES_ORDER: Stage[] = [
      Stage.SELEKSI_BERKAS,
      Stage.TES_AKADEMIK,
      Stage.WAWANCARA,
      Stage.TES_PSIKOTEST,
      Stage.HOME_VISIT,
      Stage.PENGUMUMAN_FINAL
    ];

    const index = STAGES_ORDER.indexOf(stage);

    // FIXED: Tidak boleh undefined → default: null
    const previousStage: Stage | null = STAGES_ORDER[index - 1] ?? null;

    if (previousStage !== null) {
      const prev = await prisma.workflowStage.findUnique({
        where: { userId_stage: { userId, stage: previousStage } }
      });

      if (!prev || prev.status !== StageStatus.PASSED) {
        return {
          error: `STAGE_BLOCKED: ${previousStage} belum PASSED`
        };
      }
    }


    // ============================
    // NAMA TAHAPAN (Human Readable)
    // ============================

    const readableStage: Record<Stage, string> = {
      SELEKSI_BERKAS: "Seleksi Berkas",
      TES_AKADEMIK: "Tes Akademik",
      WAWANCARA: "Wawancara",
      TES_PSIKOTEST: "Tes Psikotest",
      HOME_VISIT: "Home Visit",
      PENGUMUMAN_FINAL: "Pengumuman Akhir"
    };


    // ============================
    // UPDATE STATUS
    // ============================
    const updated = await prisma.workflowStage.update({
      where: { userId_stage: { userId, stage } },
      data: { status }
    });


    // ============================
    // CATAT HISTORY
    // ============================

    await prisma.workflowHistory.create({
      data: {
        userId,
        stage,
        oldStatus: stageRecord.status,
        newStatus: status,
        changedBy: adminId,
        note: status === StageStatus.FAILED
          ? "Tahap gagal"
          : "Tahap berhasil"
      }
    });


    // ============================
    // KIRIM NOTIFIKASI
    // ============================

    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.STATUS_UPDATE,
        message: `Tahap: ${readableStage[stage]}
Status: ${status}
Catatan: ${
          status === StageStatus.FAILED
            ? "Anda gagal pada tahap ini."
            : "Selamat! Anda lolos tahap ini."
        }`
      }
    });

    return {
      message: "Workflow updated",
      stage,
      status
    };
  }
};

