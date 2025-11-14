// src/routes/admin.ts
import { Router, Response } from "express";
import {
  PrismaClient,
  RegStatus,
  FormProgress,
  SelectionStage,
  SelectionResult,
  DocStatus,
} from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

/* ============================================================
   🔒 Middleware khusus ADMIN
============================================================ */
router.use(authenticateToken);
router.use(requireRole("ADMIN"));

/* ============================================================
   Utility: Simpan Audit Log
============================================================ */
async function logAdmin(req: AuthRequest, action: string, details?: string) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId ?? null,
        action,
        details,
        ip: req.ip || "unknown",
      },
    });
  } catch (err) {
    console.warn("Audit log failed:", err);
  }
}

/* ============================================================
   Tahap Seleksi Berurutan
============================================================ */
const STAGE_ORDER: SelectionStage[] = [
  "PENDAFTARAN",
  "SELEKSI_BERKAS",
  "TES_AKADEMIK",
  "WAWANCARA",
  "PSIKOTEST",
  "HOME_VISIT",
  "PENGUMUMAN",
];

function getNextStage(current: SelectionStage): SelectionStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  return idx >= 0 && idx < STAGE_ORDER.length - 1
    ? STAGE_ORDER[idx + 1]
    : null;
}

/* ============================================================
   📋 GET daftar registrasi (filter, paging)
============================================================ */
router.get("/registrations", async (req: AuthRequest, res: Response) => {
  try {
    const { status, q, page = "1", pageSize = "20" } = req.query;

    const where: any = {};

    if (status && Object.values(RegStatus).includes(status as RegStatus)) {
      where.status = status;
    }

    if (q) {
      where.OR = [
        { participantName: { contains: q as string, mode: "insensitive" } },
        { nisn: { contains: q as string, mode: "insensitive" } },
        {
          user: {
            email: { contains: q as string, mode: "insensitive" },
          },
        },
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
    res.json({ total, page, pageSize, data });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data registrasi" });
  }
});

/* ============================================================
   📄 GET detail registrasi
============================================================ */
router.get("/registrations/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const registration = await prisma.registration.findUnique({
      where: { id },
      include: { user: true, documents: true },
    });

    if (!registration)
      return res.status(404).json({ error: "Registrasi tidak ditemukan" });

    await logAdmin(req, "ADMIN_VIEW_REGISTRATION", `id=${id}`);
    res.json(registration);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil detail" });
  }
});

/* ============================================================
   🔍 PATCH Verifikasi Berkas (Step 1)
   - VERIFIED = diterima
   - REJECTED = ditolak + unlock
============================================================ */
router.patch("/registrations/:id/verify", async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status, adminNote } = req.body;

    if (![RegStatus.VERIFIED, RegStatus.REJECTED].includes(status)) {
      return res.status(400).json({ error: "Status tidak valid" });
    }

    const reg = await prisma.registration.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!reg) return res.status(404).json({ error: "Tidak ditemukan" });

    const newProgress =
      status === RegStatus.VERIFIED ? FormProgress.SUBMITTED : FormProgress.DRAFT;

    // UPDATE REGISTRATION
    const updated = await prisma.registration.update({
      where: { id },
      data: {
        status,
        progress: newProgress,
        verifiedBy: req.user!.userId,
        adminNote: adminNote ?? null,
      },
    });

    // UPDATE DOCUMENT STATUS (sinkronisasi)
    if (status === RegStatus.REJECTED) {
      await prisma.document.updateMany({
        where: { registrationId: id },
        data: { status: DocStatus.REJECTED },
      });
    }

    // NOTIFIKASI
    await prisma.notification.create({
      data: {
        userId: updated.userId,
        title:
          status === RegStatus.VERIFIED
            ? "Pendaftaran Berhasil Diverifikasi"
            : "Pendaftaran Ditolak",
        message:
          status === RegStatus.VERIFIED
            ? "Selamat! Berkas pendaftaranmu telah sesuai."
            : `Pendaftaran ditolak. ${adminNote ? `Catatan: ${adminNote}` : ""}`,
      },
    });

    await logAdmin(req, "ADMIN_VERIFY_REGISTRATION", `id=${id}`);
    res.json({ message: "Status verifikasi diperbarui", registration: updated });
  } catch (err) {
    res.status(500).json({ error: "Gagal memverifikasi" });
  }
});

/* ============================================================
   🧩 PATCH Tahap Seleksi (Step 2-6)
   Admin tidak boleh skip atau mundur.
============================================================ */
router.patch("/registrations/:id/stage", async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { result, note } = req.body;

    const reg = await prisma.registration.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!reg) return res.status(404).json({ error: "Registrasi tidak ditemukan" });

    let currentStage = reg.stage;
    let nextStage = getNextStage(currentStage);

    if (!nextStage)
      return res.status(400).json({ error: "Tahap akhir sudah dicapai" });

    // VALIDASI HASIL
    if (![SelectionResult.LULUS, SelectionResult.TIDAK_LULUS].includes(result)) {
      return res.status(400).json({ error: "Result tidak valid" });
    }

    let updatedStage = currentStage;
    let updatedResult: SelectionResult = result;

    if (result === SelectionResult.LULUS) updatedStage = nextStage;

    // UPDATE
    const updated = await prisma.registration.update({
      where: { id },
      data: {
        stage: updatedStage,
        selectionResult: updatedResult,
        adminNote: note ?? undefined,
        verifiedBy: req.user!.userId,
      },
    });

    // NOTIFIKASI FORMAT SESUAI PERMINTAANMU
    await prisma.notification.create({
      data: {
        userId: updated.userId,
        title:
          result === SelectionResult.LULUS
            ? `Selamat! Kamu lolos ${currentStage}`
            : `Mohon maaf kamu tidak lolos ${currentStage}`,
        message:
          result === SelectionResult.LULUS
            ? `Tahap kamu telah berubah menjadi ${updatedStage}`
            : `Kamu tidak lolos tahap ${currentStage}.`,
      },
    });

    await logAdmin(req, "ADMIN_UPDATE_STAGE", `id=${id}`);
    res.json({ message: "Tahap seleksi diperbarui", registration: updated });
  } catch (err) {
    res.status(500).json({ error: "Gagal memperbarui tahap seleksi" });
  }
});

/* ============================================================
   🏁 PATCH Finalisasi Seleksi (Step 7)
============================================================ */
router.patch("/registrations/:id/final", async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { finalResult, note } = req.body;

    if (![SelectionResult.LULUS, SelectionResult.TIDAK_LULUS].includes(finalResult)) {
      return res.status(400).json({ error: "Final result tidak valid" });
    }

    const reg = await prisma.registration.findUnique({ where: { id } });
    if (!reg) return res.status(404).json({ error: "Tidak ditemukan" });

    if (reg.stage !== "PENGUMUMAN") {
      return res
        .status(400)
        .json({ error: "Hanya bisa finalisasi pada tahap PENGUMUMAN" });
    }

    const updated = await prisma.registration.update({
      where: { id },
      data: {
        selectionResult: finalResult,
        adminNote: note ?? undefined,
        verifiedBy: req.user!.userId,
      },
    });

    // NOTIFIKASI FINAL
    await prisma.notification.create({
      data: {
        userId: updated.userId,
        title:
          finalResult === "LULUS"
            ? "SELAMAT! Kamu Dinyatakan LULUS"
            : "PENGUMUMAN: Kamu Tidak Lulus",
        message:
          finalResult === "LULUS"
            ? "Kamu dinyatakan lulus seleksi PPDB SMK TI Bazma."
            : "Mohon maaf kamu tidak lulus. Tetap semangat!",
      },
    });

    await logAdmin(req, "ADMIN_FINAL_RESULT", `id=${id}`);
    res.json({ message: "Finalisasi berhasil", registration: updated });
  } catch (err) {
    res.status(500).json({ error: "Gagal melakukan finalisasi" });
  }
});

/* ============================================================
   📊 Statistik
============================================================ */
router.get("/stats", async (req: AuthRequest, res: Response) => {
  try {
    const [total, pending, verified, rejected] = await Promise.all([
      prisma.registration.count(),
      prisma.registration.count({ where: { status: "PENDING" } }),
      prisma.registration.count({ where: { status: "VERIFIED" } }),
      prisma.registration.count({ where: { status: "REJECTED" } }),
    ]);

    const byProvince = await prisma.registration.groupBy({
      by: ["participantName"],
      _count: { participantName: true },
    });

    await logAdmin(req, "ADMIN_VIEW_STATS");
    res.json({ total, pending, verified, rejected, byProvince });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil statistik" });
  }
});

/* ============================================================
   🧹 Hapus Data Test (Dev-only)
============================================================ */
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
