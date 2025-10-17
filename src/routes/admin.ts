import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

// 🔒 Middleware khusus admin
router.use(authenticateToken);
router.use(requireRole("ADMIN"));

/**
 * 🧾 Utility: Catat aktivitas admin ke AuditLog
 */
async function logAdminAction(req: AuthRequest, action: string, targetId?: number) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId ?? null,
        action,
        details: targetId ? `Target ID: ${targetId}` : null,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        timestamp: new Date(),
      },
    });

    console.log(
      `[AuditLog] userId=${req.user?.userId ?? "unknown"} melakukan aksi: ${action} (${targetId ?? "-"})`
    );
  } catch (err) {
    console.error("Gagal mencatat audit log admin:", err);
  }
}



/**
 * 📋 GET daftar registrasi (filter, search, pagination)
 */
router.get("/registrations", async (req: AuthRequest, res: Response) => {
  try {
    const { status, q, page = "1", pageSize = "20" } = req.query;
    const where: any = {};

    if (status) where.status = status;
    if (q) {
      where.OR = [
        { participant: { fullName: { contains: q as string, mode: "insensitive" } } },
        { participant: { nisn: { contains: q as string } } },
        { participant: { nik: { contains: q as string } } },
      ];
    }

    const total = await prisma.registration.count({ where });

    const registrations = await prisma.registration.findMany({
      where,
      include: {
        user: true,
        participant: true,
        achievements: true,
        parents: true,
        housing: true,
        health: true,
        consent: true,
        documents: true,
      },
      skip: (Number(page) - 1) * Number(pageSize),
      take: Number(pageSize),
      orderBy: { createdAt: "desc" },
    });

    await logAdminAction(req, "Melihat daftar registrasi");
    res.json({ total, page, pageSize, data: registrations });
  } catch (error) {
    console.error("Error get registrations:", error);
    res.status(500).json({ error: "Gagal mengambil daftar registrasi" });
  }
});

/**
 * 📄 GET detail registrasi lengkap
 */
router.get("/registrations/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const registration = await prisma.registration.findUnique({
      where: { id },
      include: {
        user: true,
        participant: true,
        achievements: true,
        parents: true,
        housing: true,
        health: true,
        consent: true,
        documents: true,
      },
    });

    if (!registration) return res.status(404).json({ error: "Registrasi tidak ditemukan" });
    await logAdminAction(req, "Melihat detail registrasi", id);
    res.json(registration);
  } catch (error) {
    console.error("Error get detail:", error);
    res.status(500).json({ error: "Gagal mengambil detail registrasi" });
  }
});

/**
 * ✅ PATCH verifikasi registrasi + beri catatan
 */
router.patch("/registrations/:id/verify", async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status, adminNote } = req.body;

    if (!["PENDING", "VERIFIED", "REJECTED"].includes(status)) {
      return res.status(400).json({ error: "Status tidak valid" });
    }

    // 🔎 Ambil data registrasi
    const registration = await prisma.registration.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!registration) {
      return res.status(404).json({ error: "Registrasi tidak ditemukan" });
    }

    // 🔄 Tentukan progress baru
    let newProgress = registration.progress;
    if (status === "REJECTED") {
      newProgress = "DRAFT"; // auto-unlock agar user bisa revisi
    } else if (status === "VERIFIED") {
      newProgress = "SUBMITTED"; // tetap terkunci
    }

    // 🧾 Update status & progress
    const updated = await prisma.registration.update({
      where: { id },
      data: {
        status,
        progress: newProgress,
        adminNote: adminNote ?? null,
        verifiedBy: req.user!.userId,
      },
      include: { user: true, participant: true },
    });

    // 🔔 Kirim notifikasi ke user
    await prisma.notification.create({
      data: {
        userId: updated.userId,
        title:
          status === "VERIFIED"
            ? "✅ Pendaftaran Diverifikasi"
            : status === "REJECTED"
            ? "❌ Pendaftaran Ditolak"
            : "⏳ Pendaftaran Ditunda",
        message:
          status === "REJECTED"
            ? `Data pendaftaranmu ditolak. ${adminNote ? "Catatan: " + adminNote : "Silakan perbaiki dan kirim ulang."}`
            : status === "VERIFIED"
            ? "Selamat! Pendaftaranmu telah diverifikasi dan diterima."
            : "Pendaftaranmu sedang ditinjau. Harap menunggu.",
      },
    });

    // 🧠 Audit log admin
    await logAdminAction(req, `Verifikasi registrasi (${status})`, id);

    res.json({ message: "Status registrasi diperbarui", registration: updated });
  } catch (error: any) {
    console.error("Error verify registration:", error);
    res.status(500).json({ error: "Gagal memperbarui status registrasi" });
  }
});


/**
 * 🧩 PATCH tahap seleksi (stage) + hasil penilaian (LULUS / TIDAK_LULUS)
 */
router.patch("/registrations/:id/stage", async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { stage, result, note } = req.body;

    if (
      ![
        "PENDAFTARAN",
        "SELEKSI_BERKAS",
        "TES_AKADEMIK",
        "PSIKOTEST",
        "WAWANCARA",
        "PENGUMUMAN",
      ].includes(stage)
    ) {
      return res.status(400).json({ error: "Tahap seleksi tidak valid" });
    }

    if (result && !["LULUS", "TIDAK_LULUS"].includes(result)) {
      return res.status(400).json({ error: "Hasil seleksi tidak valid" });
    }

    const registration = await prisma.registration.update({
      where: { id },
      data: {
        stage,
        selectionResult: result ?? null,
        adminNote: note ?? undefined,
        verifiedBy: req.user!.userId,
      },
      include: { user: true, participant: true },
    });

    await prisma.notification.create({
      data: {
        userId: registration.userId,
        title: `Tahap seleksi diperbarui: ${stage}`,
        message:
          result === "LULUS"
            ? `Selamat! Kamu lolos ke tahap ${stage} berikutnya.`
            : result === "TIDAK_LULUS"
            ? `Maaf, kamu belum lolos pada tahap ${stage}.`
            : `Kamu sekarang berada di tahap ${stage}. Harap menunggu informasi selanjutnya.`,
      },
    });

    await logAdminAction(req, "Update tahap seleksi", id);
    res.json({ message: "Tahap seleksi diperbarui", registration });
  } catch (error) {
    console.error("Error update stage:", error);
    res.status(500).json({ error: "Gagal memperbarui tahap seleksi" });
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

    const byStage = await prisma.registration.groupBy({
      by: ["stage"],
      _count: { stage: true },
    });

    await logAdminAction(req, "Melihat statistik pendaftar");
    res.json({
      total,
      pending,
      verified,
      rejected,
      byStage,
    });
  } catch (error) {
    console.error("Error get stats:", error);
    res.status(500).json({ error: "Gagal mengambil statistik" });
  }
});


router.get("/logs", async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 100,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Gagal mengambil log aktivitas admin" });
  }
});

// ========================================================
// 🧹 Admin Cleanup Endpoint (hapus user test otomatis)
// ========================================================
router.delete("/cleanup-test-data", requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email diperlukan" });

    // Hapus user & semua registrasi terkait
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ message: "User tidak ditemukan, skip" });

    await prisma.registration.deleteMany({ where: { userId: user.id } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });

    res.json({ message: `Data user ${email} berhasil dihapus` });
  } catch (err) {
    console.error("Cleanup error:", err);
    res.status(500).json({ error: "Gagal menghapus data test" });
  }
});


export default router;
