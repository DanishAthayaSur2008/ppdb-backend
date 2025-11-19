// src/routes/admin.ts
import { Router, Response } from "express";
import { PrismaClient, RegStatus, FormProgress, DocStatus, SelectionStage, SelectionResult } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

router.use(authenticateToken);
router.use(requireRole("ADMIN"));

async function logAdmin(req: AuthRequest, action: string, details?: string) {
  try {
    await prisma.auditLog.create({
      data: { userId: req.user?.userId ?? null, action, details, ip: req.ip || "unknown" },
    });
  } catch (err) {
    console.warn("Audit log failed:", err);
  }
}

const STAGE_ORDER: SelectionStage[] = [
  "PENDAFTARAN",
  "SELEKSI_BERKAS",
  "TES_AKADEMIK",
  "WAWANCARA",
  "PSIKOTEST",
  "HOME_VISIT",
  "PENGUMUMAN",
];

function getNextStage(current: SelectionStage) {
  const idx = STAGE_ORDER.indexOf(current);
  return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
}

router.get("/registrations", async (req: AuthRequest, res: Response) => {
  try {
    const { status, q, page = "1", pageSize = "20" } = req.query;
    const where: any = {};
    if (status && Object.values(RegStatus).includes(status as RegStatus)) where.status = status;
    if (q) {
      where.OR = [
        { participantName: { contains: String(q), mode: "insensitive" } },
        { nisn: { contains: String(q), mode: "insensitive" } },
        { user: { email: { contains: String(q), mode: "insensitive" } } },
      ];
    }

    const total = await prisma.registration.count({ where });
    const data = await prisma.registration.findMany({
      where,
      include: { user: true, documents: true },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      orderBy: { createdAt: "desc" },
    });

    await logAdmin(req, "ADMIN_LIST_REGISTRATIONS");
    res.json({ total, page: Number(page), pageSize: Number(pageSize), data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data registrasi" });
  }
});

router.get("/registrations/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const registration = await prisma.registration.findUnique({ where: { id }, include: { user: true, documents: true } });
    if (!registration) return res.status(404).json({ error: "Registrasi tidak ditemukan" });

    await logAdmin(req, "ADMIN_VIEW_REGISTRATION", `id=${id}`);
    res.json(registration);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil detail" });
  }
});

/**
 * Verifikasi berkas (approve/reject registration overall)
 */
router.patch("/registrations/:id/verify", async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status, adminNote } = req.body;
    if (![RegStatus.VERIFIED, RegStatus.REJECTED].includes(status)) return res.status(400).json({ error: "Status tidak valid" });

    const reg = await prisma.registration.findUnique({ where: { id }, include: { user: true } });
    if (!reg) return res.status(404).json({ error: "Tidak ditemukan" });

    const newProgress = status === RegStatus.VERIFIED ? FormProgress.SUBMITTED : FormProgress.DRAFT;

    const updated = await prisma.registration.update({
      where: { id },
      data: { status, progress: newProgress, verifiedBy: req.user!.userId, adminNote: adminNote ?? null },
    });

    if (status === RegStatus.REJECTED) {
      await prisma.document.updateMany({ where: { registrationId: id }, data: { status: DocStatus.REJECTED } });
    }

    await prisma.notification.create({
      data: {
        userId: updated.userId,
        title: status === RegStatus.VERIFIED ? "Pendaftaran Berhasil Diverifikasi" : "Pendaftaran Ditolak",
        message: status === RegStatus.VERIFIED ? "Selamat! Berkas pendaftaranmu telah sesuai." : `Pendaftaran ditolak. ${adminNote ? `Catatan: ${adminNote}` : ""}`,
      },
    });

    await logAdmin(req, "ADMIN_VERIFY_REGISTRATION", `id=${id}`);
    res.json({ message: "Status verifikasi diperbarui", registration: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memverifikasi" });
  }
});

/**
 * PATCH /admin/registrations/:id/stage
 * Admin updates to next stage only (restrict + sequential)
 */
router.patch("/registrations/:id/stage", async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { result, note } = req.body;
    const reg = await prisma.registration.findUnique({ where: { id } });
    if (!reg) return res.status(404).json({ error: "Registrasi tidak ditemukan" });

    const currentStage = reg.stage as SelectionStage;
    const nextStage = getNextStage(currentStage);
    if (!nextStage) return res.status(400).json({ error: "Tahap akhir sudah dicapai" });

    if (![SelectionResult.LULUS, SelectionResult.TIDAK_LULUS].includes(result)) {
      return res.status(400).json({ error: "Result tidak valid" });
    }

    const newStage = result === SelectionResult.LULUS ? nextStage : currentStage;

    const updated = await prisma.registration.update({
      where: { id },
      data: {
        stage: newStage,
        selectionResult: result,
        adminNote: note ?? undefined,
        verifiedBy: req.user!.userId,
      },
    });

    await prisma.notification.create({
      data: {
        userId: updated.userId,
        title: result === SelectionResult.LULUS ? `Selamat! Kamu lolos ${currentStage}` : `Mohon maaf kamu tidak lolos ${currentStage}`,
        message: result === SelectionResult.LULUS ? `Tahap kamu telah berubah menjadi ${newStage}` : `Kamu tidak lolos tahap ${currentStage}.`,
      },
    });

    await logAdmin(req, "ADMIN_UPDATE_STAGE", `id=${id}`);
    res.json({ message: "Tahap seleksi diperbarui", registration: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memperbarui tahap seleksi" });
  }
});

router.patch("/registrations/:id/status", async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status, adminNote } = req.body;
    if (!["PENDING", "VERIFIED", "REJECTED"].includes(status)) return res.status(400).json({ error: "Status tidak valid" });

    const registration = await prisma.registration.findUnique({ where: { id }, include: { user: true } });
    if (!registration) return res.status(404).json({ error: "Registrasi tidak ditemukan" });

    let newProgress = registration.progress;
    if (status === "REJECTED") newProgress = FormProgress.DRAFT;
    if (status === "VERIFIED") newProgress = FormProgress.SUBMITTED;

    const updated = await prisma.registration.update({
      where: { id },
      data: { status, progress: newProgress, adminNote: adminNote ?? undefined, verifiedBy: req.user!.userId },
      include: { user: true },
    });

    // create stages if verified
    if (status === "VERIFIED") {
      await prisma.registrationStage.createMany({
        data: [
          { registrationId: updated.id, stageName: "seleksi_berkas", status: "pending" },
          { registrationId: updated.id, stageName: "tes_akademik", status: "pending" },
          { registrationId: updated.id, stageName: "wawancara", status: "pending" },
          { registrationId: updated.id, stageName: "psikotest", status: "pending" },
          { registrationId: updated.id, stageName: "home_visit", status: "pending" },
          { registrationId: updated.id, stageName: "pengumuman", status: "pending" },
        ],
      });
    }

    await prisma.notification.create({
      data: {
        userId: updated.userId,
        title: status === "VERIFIED" ? "Pendaftaran Terverifikasi ✅" : status === "REJECTED" ? "Pendaftaran Ditolak ❌" : "Status Pendaftaran Diperbarui",
        message: adminNote || (status === "VERIFIED" ? "Selamat! Pendaftaranmu telah terverifikasi." : status === "REJECTED" ? "Pendaftaran ditolak. Silakan periksa catatan admin dan perbaiki." : "Status pendaftaran diperbarui oleh admin."),
      },
    });

    await logAdmin(req, "ADMIN_UPDATE_STATUS", `registrationId=${id} status=${status}`);
    res.json({ message: "Status registrasi diperbarui", registration: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memperbarui status registrasi" });
  }
});

router.get("/stats", async (req: AuthRequest, res: Response) => {
  try {
    const [total, pending, verified, rejected] = await Promise.all([
      prisma.registration.count(),
      prisma.registration.count({ where: { status: "PENDING" } }),
      prisma.registration.count({ where: { status: "VERIFIED" } }),
      prisma.registration.count({ where: { status: "REJECTED" } }),
    ]);

    await logAdmin(req, "ADMIN_VIEW_STATS");
    res.json({ total, pending, verified, rejected });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil statistik" });
  }
});

router.delete("/cleanup-test-data", async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email diperlukan" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ message: "User tidak ditemukan" });

    await prisma.registration.deleteMany({ where: { userId: user.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });

    res.json({ message: `Data test untuk ${email} dihapus` });
  } catch (err) {
    res.status(500).json({ error: "Cleanup gagal" });
  }
});

export default router;
