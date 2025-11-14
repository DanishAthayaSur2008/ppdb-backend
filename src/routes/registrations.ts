// src/routes/registrations.ts
import { Router, Response } from "express";
import { PrismaClient, FormProgress, RegStatus } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

/**
 * Helper: tulis audit log sederhana
 */
async function writeAudit(userId: number | null, action: string, details?: string) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? undefined,
        action,
        details,
        ip: null,
      },
    });
  } catch (err) {
    console.warn("AuditLog failed:", (err as any).message ?? err);
  }
}


function findMissingSections(formData: any) {
  const required = [
    "personal",
    "prestasi",
    "orangtua",
    "rumah",
    "kesehatan",
    "upload",
    "pernyataan",
  ];
  const missing: string[] = [];
  for (const key of required) {
    if (!formData || typeof formData !== "object" || !(key in formData)) {
      missing.push(key);
    }
  }
  return missing;
}

/**
 * POST /api/registrations
 * buat registrasi awal (DRAFT)
 */
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // cek jika user sudah ada registrasi (single registration rule)
    const existing = await prisma.registration.findFirst({
      where: { userId },
    });
    if (existing) {
      return res.status(400).json({ error: "User sudah memiliki registrasi" });
    }

    const registration = await prisma.registration.create({
      data: {
        userId,
        // formData kosong (draf)
        formData: {},
        progress: FormProgress.DRAFT,
        status: RegStatus.PENDING,
      },
    });

    await writeAudit(userId, "CREATE_REGISTRATION", `registrationId=${registration.id}`);
    res.status(201).json({ message: "Registrasi berhasil dibuat", registration });
  } catch (err: any) {
    console.error("Error create registration:", err);
    res.status(500).json({ error: "Gagal membuat registrasi" });
  }
});

/**
 * PATCH /api/registrations/:id/autosave
 * autosave partial formData (only when progress === DRAFT)
 * body: { sectionKey: {...} } atau whole partial formData
 */
router.patch("/:id/autosave", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.userId;
    const payload = req.body; // partial formData

    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) return res.status(404).json({ error: "Registrasi tidak ditemukan" });
    if (registration.userId !== userId) return res.status(403).json({ error: "Bukan milikmu" });

    // tidak boleh autosave jika sudah SUBMITTED / LOCKED
    if (registration.progress !== FormProgress.DRAFT) {
      return res.status(403).json({ error: "Form terkunci, tidak bisa autosave" });
    }

    // merge partial formData (shallow merge). Frontend should send e.g. { personal: { ... } }
    const existing = (registration.formData as any) || {};
    const merged = { ...existing, ...(payload || {}) };

    // Ambil nama lengkap & nisn dari payload (jika ada)
// Ambil nama lengkap & nisn dari payload (jika ada)
let participantName: string | undefined;
let nisn: string | undefined;

const personal = merged.personal || {};
if (personal.namaLengkap) participantName = personal.namaLengkap;
if (personal.nisn) nisn = String(personal.nisn);

const updated = await prisma.registration.update({
  where: { id },
  data: {
    formData: merged,
    participantName,
    nisn,
  },
});



    // notifikasi ringan ke user (opsional) — hanya buat ringkasan
    await prisma.notification.create({
      data: {
        userId,
        title: "Progress tersimpan",
        message: "Perubahan form kamu telah disimpan sementara.",
      },
    });

    await writeAudit(userId, "AUTOSAVE_REGISTRATION", `registrationId=${id}`);
    res.json({ message: "Autosave berhasil", registration: updated });
  } catch (err: any) {
    console.error("Error autosave:", err);
    res.status(500).json({ error: "Gagal melakukan autosave" });
  }
});

/**
 * PATCH /api/registrations/:id/submit
 * user submit final -> progress => SUBMITTED (lock)
 * basic validation: cek semua section ada (findMissingSections)
 */
router.patch("/:id/submit", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.userId;

    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) return res.status(404).json({ error: "Registrasi tidak ditemukan" });
    if (registration.userId !== userId) return res.status(403).json({ error: "Bukan milikmu" });

    // tidak boleh submit dua kali
    if (registration.progress === FormProgress.SUBMITTED) {
      return res.status(400).json({ error: "Pendaftaran sudah dikirim sebelumnya" });
    }

    // harus dalam DRAFT
    if (registration.progress !== FormProgress.DRAFT) {
      return res.status(403).json({ error: "Form tidak dalam kondisi dapat dikirim" });
    }

    // basic check: pastikan semua section sudah ada di formData
    const formData = registration.formData as any;
    // Ambil nama lengkap & nisn dari formData.personal
    const personal = formData?.personal || {};
    const participantName = personal.namaLengkap || registration.participantName;
    const nisn = personal.nisn ? String(personal.nisn) : registration.nisn;

    const missing = findMissingSections(formData);
    if (missing.length > 0) {
      return res.status(400).json({
        error: "Form belum lengkap",
        missing,
      });
    }

    // set progress => SUBMITTED and status => PENDING (untuk diverifikasi admin)
    const updated = await prisma.registration.update({
      where: { id },
    data: {
    progress: FormProgress.SUBMITTED,
    status: RegStatus.PENDING,
    participantName,
    nisn,
   },
      include: { user: true },
  });


    // notifikas
    await prisma.notification.create({
      data: {
        userId,
        title: "Pendaftaran dikirim",
        message: "Data dan dokumenmu telah dikirim. Tunggu verifikasi dari admin.",
      },
    });

    await writeAudit(userId, "SUBMIT_REGISTRATION", `registrationId=${id}`);
    res.json({ message: "Pendaftaran berhasil dikirim", registration: updated });
  } catch (err: any) {
    console.error("Error submit registration:", err);
    res.status(500).json({ error: "Gagal mengirim pendaftaran" });
  }
});

/**
 * GET /api/registrations/:id
 * Ambil detail pendaftaran (user owner atau admin)
 */
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const requester = req.user!;
    const registration = await prisma.registration.findUnique({
      where: { id },
      include: {
        user: true,
        documents: true,
      },
    });
    if (!registration) return res.status(404).json({ error: "Registrasi tidak ditemukan" });

    // owner or admin
    if (registration.userId !== requester.userId && requester.role !== "ADMIN") {
      return res.status(403).json({ error: "Tidak punya akses ke registrasi ini" });
    }

    // jika user (bukan admin) dan progress SUBMITTED, frontend harus menampilkan readonly.
    // backend tetap mengembalikan data; frontend yang akan men-disable edit UI.
    res.json(registration);
  } catch (err: any) {
    console.error("Error get registration:", err);
    res.status(500).json({ error: "Gagal mengambil data registrasi" });
  }
});

/**
 * GET /api/registrations
 * List (ADMIN only) — dengan pagination & filter sederhana
 */
router.get("/", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const page = Number((req.query.page as string) || "1");
    const pageSize = Math.min(Number((req.query.pageSize as string) || "20"), 200);
    const status = (req.query.status as string) || undefined;
    const q = (req.query.q as string) || undefined; // currently searches by user.email

    const where: any = {};
    if (status) where.status = status;
    if (q) {
      where.OR = [
    { user: { email: { contains: q, mode: "insensitive" } } },
    { participantName: { contains: q, mode: "insensitive" } },
    { nisn: { contains: q, mode: "insensitive" } },
  ];
}
if (q) {
      where.user = { email: { contains: q, mode: "insensitive" } };
    }

    const [total, registrations] = await Promise.all([
      prisma.registration.count({ where }),
      prisma.registration.findMany({
        where,
        include: { user: true, documents: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    await writeAudit(req.user!.userId, "ADMIN_LIST_REGISTRATIONS", `q=${q ?? "-"} status=${status ?? "-"}`);
    res.json({ total, page, pageSize, data: registrations });
  } catch (err: any) {
    console.error("Error admin list registrations:", err);
    res.status(500).json({ error: "Gagal mengambil daftar registrasi" });
  }
});

/**
 * PATCH /api/registrations/:id/status
 * Admin-only: ubah status PENDING / VERIFIED / REJECTED
 * Jika REJECTED -> auto-unlock (progress -> DRAFT) sehingga user bisa revisi.
 * Jika VERIFIED -> keep locked (SUBMITTED) and status VERIFIED.
 */
router.patch("/:id/status", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status, adminNote } = req.body;
    if (!["PENDING", "VERIFIED", "REJECTED"].includes(status)) {
      return res.status(400).json({ error: "Status tidak valid" });
    }

    const registration = await prisma.registration.findUnique({ where: { id }, include: { user: true } });
    if (!registration) return res.status(404).json({ error: "Registrasi tidak ditemukan" });

    let newProgress = registration.progress;
    if (status === "REJECTED") {
      newProgress = FormProgress.DRAFT; // unlock so user can fix
    } else if (status === "VERIFIED") {
      newProgress = FormProgress.SUBMITTED; // keep locked (final)
    }

    const updated = await prisma.registration.update({
      where: { id },
      data: {
        status,
        progress: newProgress,
        adminNote: adminNote ?? undefined,
        verifiedBy: req.user!.userId,
      },
      include: { user: true },
    });

    // create notification for user
    await prisma.notification.create({
      data: {
        userId: updated.userId,
        title:
          status === "VERIFIED"
            ? "Pendaftaran Terverifikasi ✅"
            : status === "REJECTED"
            ? "Pendaftaran Ditolak ❌"
            : "Status Pendaftaran Diperbarui",
        message:
          adminNote ||
          (status === "VERIFIED"
            ? "Selamat! Pendaftaranmu telah terverifikasi."
            : status === "REJECTED"
            ? "Pendaftaran ditolak. Silakan periksa catatan admin dan perbaiki."
            : "Status pendaftaran diperbarui oleh admin."),
      },
    });

    await writeAudit(req.user!.userId, "ADMIN_UPDATE_STATUS", `registrationId=${id} status=${status}`);
    res.json({ message: "Status registrasi diperbarui", registration: updated });
  } catch (err: any) {
    console.error("Error update status:", err);
    res.status(500).json({ error: "Gagal memperbarui status registrasi" });
  }
});

export default router;
