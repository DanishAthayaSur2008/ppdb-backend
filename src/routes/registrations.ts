// src/routes/registrations.ts
import { Router, Response } from "express";
import { PrismaClient, FormProgress, RegStatus } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

// ============================
// Helpers
// ============================

async function writeAudit(userId: number | null, action: string, details?: string) {
  try {
    await prisma.auditLog.create({
      data: { userId: userId ?? undefined, action, details }
    });
  } catch (err) {
    console.warn("Audit write failed:", err);
  }
}

const REQUIRED_SECTIONS = [
  "personal", "prestasi", "orangtua", "rumah",
  "kesehatan", "upload", "pernyataan"
];

function findMissingSections(formData: any) {
  const missing: string[] = [];
  for (const key of REQUIRED_SECTIONS) {
    if (!formData || typeof formData !== "object" || !(key in formData)) {
      missing.push(key);
    }
  }
  return missing;
}

// ===============================================
// 1️⃣ GET /api/registrations/me  (paling atas!)
// ===============================================
router.get("/me", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const registration = await prisma.registration.findFirst({
      where: { userId },
      include: { documents: true, stages: true }
    });

    if (!registration) {
      return res.json({ hasRegistration: false });
    }

    const canEdit =
      registration.progress === FormProgress.DRAFT ||
      registration.status === RegStatus.REJECTED;

    res.json({
      hasRegistration: true,
      id: registration.id,
      status: registration.status,
      progress: registration.progress,
      stage: registration.stage,
      selectionResult: registration.selectionResult,
      adminNote: registration.adminNote,
      canEdit,
      formData: registration.formData ?? {},
      documents: registration.documents ?? [],
      stages: registration.stages ?? []
    });

  } catch (err) {
    console.error("Error /me:", err);
    res.status(500).json({ error: "Gagal mengambil registrasi Anda" });
  }
});

// =======================================================
// 2️⃣ POST /api/registrations  (create new registration)
// =======================================================
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const existing = await prisma.registration.findFirst({ where: { userId } });
    if (existing) {
      return res.status(400).json({ error: "User sudah memiliki registrasi" });
    }

    const registration = await prisma.registration.create({
      data: {
        userId,
        formData: {},
        progress: FormProgress.DRAFT,
        status: RegStatus.PENDING
      }
    });

    await writeAudit(userId, "CREATE_REGISTRATION", `registrationId=${registration.id}`);

    res.status(201).json({
      message: "Registrasi berhasil dibuat",
      registration
    });

  } catch (err) {
    console.error("Error create registration:", err);
    res.status(500).json({ error: "Gagal membuat registrasi" });
  }
});

// =======================================================
// 3️⃣ PATCH /api/registrations/:id/autosave
// =======================================================
router.patch("/:id/autosave", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });

    const userId = req.user!.userId;
    const payload = req.body || {};

    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) return res.status(404).json({ error: "Registrasi tidak ditemukan" });
    if (registration.userId !== userId) return res.status(403).json({ error: "Akses ditolak" });

    const canEdit =
      registration.progress === FormProgress.DRAFT ||
      registration.status === RegStatus.REJECTED;

    if (!canEdit) {
      return res.status(403).json({ error: "Form terkunci, tidak dapat diubah" });
    }

    // safe merge
    const existing = registration.formData as any || {};
    const merged = { ...existing, ...payload };

    // auto-fill summary fields
    const personal = merged.personal || {};
    const participantName = personal.namaLengkap || registration.participantName;
    const nisn = personal.nisn ? String(personal.nisn) : registration.nisn;

    const updated = await prisma.registration.update({
      where: { id },
      data: {
        formData: merged,
        participantName,
        nisn
      }
    });

    await writeAudit(userId, "AUTOSAVE_REGISTRATION", `registrationId=${id}`);

    res.json({
      message: "Autosave berhasil",
      registration: updated
    });

  } catch (err) {
    console.error("Error autosave:", err);
    res.status(500).json({ error: "Gagal melakukan autosave" });
  }
});

// =======================================================
// 4️⃣ PATCH /api/registrations/:id/submit
// =======================================================
router.patch("/:id/submit", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });

    const userId = req.user!.userId;

    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) return res.status(404).json({ error: "Registrasi tidak ditemukan" });
    if (registration.userId !== userId) return res.status(403).json({ error: "Akses ditolak" });

    if (registration.progress === FormProgress.SUBMITTED) {
      return res.status(400).json({ error: "Pendaftaran sudah dikirim sebelumnya" });
    }

    const formData = registration.formData as any;
    const missing = findMissingSections(formData);

    if (missing.length > 0) {
      return res.status(400).json({ error: "Form belum lengkap", missing });
    }

    const personal = formData?.personal || {};
    const participantName = personal.namaLengkap || registration.participantName;
    const nisn = personal.nisn ? String(personal.nisn) : registration.nisn;

    const updated = await prisma.registration.update({
      where: { id },
      data: {
        progress: FormProgress.SUBMITTED,
        status: RegStatus.PENDING,
        participantName,
        nisn
      }
    });

    await prisma.notification.create({
      data: {
        userId,
        title: "Pendaftaran dikirim",
        message: "Data dan dokumenmu telah dikirim. Menunggu verifikasi admin."
      }
    });

    await writeAudit(userId, "SUBMIT_REGISTRATION", `registrationId=${id}`);

    res.json({
      message: "Pendaftaran berhasil dikirim",
      registration: updated
    });

  } catch (err) {
    console.error("Error submit:", err);
    res.status(500).json({ error: "Gagal mengirim pendaftaran" });
  }
});

// =======================================================
// 5️⃣ GET /api/registrations/:id  (detail owner/admin)
// =======================================================
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });

    const requester = req.user!;

    const registration = await prisma.registration.findUnique({
      where: { id },
      include: {
        user: true,
        documents: true,
        stages: true
      }
    });

    if (!registration) return res.status(404).json({ error: "Registrasi tidak ditemukan" });

    if (registration.userId !== requester.userId && requester.role !== "ADMIN") {
      return res.status(403).json({ error: "Tidak punya akses ke registrasi ini" });
    }

    res.json(registration);

  } catch (err) {
    console.error("Error get /:id:", err);
    res.status(500).json({ error: "Gagal mengambil data registrasi" });
  }
});

export default router;
