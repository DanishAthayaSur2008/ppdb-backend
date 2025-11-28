import { prisma } from "../../database/prisma";

/**
 * adminService
 * - listByStatus(status)
 * - getFormDetail(formId)
 * - approveForm(formId, adminId)
 * - rejectForm(formId, adminId, note)
 *
 * NOTE:
 * - semua return sudah diserialisasi (tidak mereturn Prisma objects lengkap)
 */

export const adminService = {
  // List form by form.status (PENDING / ACCEPTED / REJECTED)
  async listByStatus(status: "PENDING" | "ACCEPTED" | "REJECTED") {
    // ambil ringkasan form + user basic
    const forms = await prisma.form.findMany({
      where: { status },
      orderBy: { submittedAt: "desc" },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        },
        registrationStatus: true
      }
    });

    // serialisasi
    return forms.map((f) => ({
      id: f.id,
      user: f.user,
      status: f.status,
      submittedAt: f.submittedAt,
      updatedAt: f.updatedAt,
      registrationStatus: f.registrationStatus ?? null
    }));
  },

  // Detail form lengkap (for admin view)
  async getFormDetail(formId: string) {
    const form = await prisma.form.findUnique({
      where: { id: formId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        sections: true,
        documents: true,
        registrationStatus: true,
        adminNotes: { orderBy: { createdAt: "desc" } }
      }
    });

    if (!form) return { error: "Form not found" };

    // serialize sections and documents
    const sections = (form.sections ?? []).map((s) => ({
      id: s.id,
      sectionNumber: s.sectionNumber,
      answers: s.answers,
      updatedAt: s.updatedAt
    }));

    const documents = (form.documents ?? []).map((d) => ({
      id: d.id,
      sectionNumber: d.sectionNumber,
      fieldName: d.fieldName,
      fileUrl: d.fileUrl,
      uploadedAt: d.uploadedAt
    }));

    const adminNotes = (form.adminNotes ?? []).map((n) => ({
      id: n.id,
      adminId: n.adminId,
      note: n.note,
      createdAt: n.createdAt
    }));

    return {
      id: form.id,
      status: form.status,
      submittedAt: form.submittedAt,
      user: form.user,
      registrationStatus: form.registrationStatus ?? null,
      sections,
      documents,
      adminNotes
    };
  },

  // Approve form (seleksi berkas accepted)
  async approveForm(formId: string, adminId: string) {
    // cek form
    const form = await prisma.form.findUnique({ where: { id: formId } });
    if (!form) return { error: "Form not found" };

    // only allow approve if current status is PENDING
    if (form.status !== "PENDING") {
      return { error: "Only PENDING forms can be approved" };
    }

    // transactional updates: update form, registrationStatus, workflowStage/history, notification
    const result = await prisma.$transaction(async (tx) => {
      // update form status
      const updatedForm = await tx.form.update({
        where: { id: formId },
        data: { status: "ACCEPTED" }
      });

      // upsert registration status
      await tx.registrationStatus.upsert({
        where: { formId },
        update: { status: "ACCEPTED", note: null },
        create: { formId, status: "ACCEPTED", note: null }
      });

      // create (or update) workflow for SELEKSI_BERKAS to PASSED
      await tx.workflowStage.upsert({
        where: { userId_stage: { userId: form.userId, stage: "SELEKSI_BERKAS" } as any } as any,
        update: { status: "PASSED" },
        create: {
          userId: form.userId,
          stage: "SELEKSI_BERKAS",
          status: "PASSED"
        }
      });

      // ensure next stage exists (TES_AKADEMIK) with PENDING status
      // create only if not exists
      const nextStage = "TES_AKADEMIK";
      const existingNext = await tx.workflowStage.findUnique({
        where: { userId_stage: { userId: form.userId, stage: nextStage } as any } as any
      });

      if (!existingNext) {
        await tx.workflowStage.create({
          data: {
            userId: form.userId,
            stage: nextStage as any,
            status: "PENDING"
          }
        });
      }

      // add history record
      await tx.workflowHistory.create({
        data: {
          userId: form.userId,
          stage: "SELEKSI_BERKAS",
          oldStatus: "PENDING",
          newStatus: "PASSED",
          note: "Seleksi berkas diterima oleh admin",
          changedBy: adminId
        }
      });

      // create notification for the user
      await tx.notification.create({
        data: {
          userId: form.userId,
          message: "Berkas Anda telah diverifikasi dan dinyatakan LULUS seleksi berkas.",
          type: "STATUS_UPDATE"
        }
      });

      return updatedForm;
    });

    // serialize response
    return {
      message: "Form approved",
      form: {
        id: result.id,
        status: result.status,
        submittedAt: result.submittedAt,
        updatedAt: result.updatedAt
      }
    };
  },

  // Reject form (admin note + registrationStatus = REJECTED + unlock for user)
  async rejectForm(formId: string, adminId: string, note: string) {
    const form = await prisma.form.findUnique({ where: { id: formId } });
    if (!form) return { error: "Form not found" };

    // only allow reject if current status is PENDING
    if (form.status !== "PENDING") return { error: "Only PENDING forms can be rejected" };

    const result = await prisma.$transaction(async (tx) => {
      // set form status to REJECTED
      const updatedForm = await tx.form.update({
        where: { id: formId },
        data: { status: "REJECTED" }
      });

      // upsert registration status
      await tx.registrationStatus.upsert({
        where: { formId },
        update: { status: "REJECTED", note },
        create: { formId, status: "REJECTED", note }
      });

      // save admin note
      await tx.adminNote.create({
        data: {
          formId,
          adminId,
          note
        }
      });

      // create workflow history marking SELEKSI_BERKAS failed if exists
      await tx.workflowHistory.create({
        data: {
          userId: form.userId,
          stage: "SELEKSI_BERKAS",
          oldStatus: "PENDING",
          newStatus: "FAILED",
          note,
          changedBy: adminId
        }
      });

      // create notification to user
      await tx.notification.create({
        data: {
          userId: form.userId,
          message: `Pendaftaran Anda ditolak: ${note}`,
          type: "STATUS_UPDATE"
        }
      });

      return updatedForm;
    });

    return {
      message: "Form rejected and user notified",
      form: {
        id: result.id,
        status: result.status,
        submittedAt: result.submittedAt,
        updatedAt: result.updatedAt
      }
    };
  }
};
