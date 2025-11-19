// src/routes/registrations.ts
import { Router, Response } from "express";
import { PrismaClient, FormProgress, RegStatus } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

// helper audit (simple)
async function writeAudit(userId: number | null, action: string, details?: string) {
  try {
    await prisma.auditLog.create({ data: { userId: userId ?? undefined, action, details, ip: null } });
  } catch (err) {
    console.warn("AuditLog failed:", (err as any).message ?? err);
  }
}

const REQUIRED_SECTIONS = ["personal", "prestasi", "orangtua", "rumah", "kesehatan", "upload", "pernyataan"];

function findMissingSections(formData: any) {
  const missing: string[] = [];
  for (const key of REQUIRED_SECTIONS) {
    if (!formData || typeof formData !== "object" || !(key in formData)) missing.push(key);
  }
  return missing;
}

/**
 * POST /api/registrations
 * Buat registrasi awal (DRAFT)
 */
router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const existing = await prisma.registration.findFirst({ where: { userId } });
    if (existing) return res.status(400).json({ error: "User sudah memiliki registrasi" });

    const registration = await prisma.registration.create({
      data: { userId, formData: {}, progress: FormProgress.DRAFT, status: RegStatus.PENDING },
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
 * merge partial formData (frontend should send { personal: {...} } etc.)
 * autosave NOT sending notification (as requested)
 */
router.patch("/:id/autosave", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.userId;
    const payload = req.body || {};

    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) return res.status(404).json({ error: "Registrasi tidak ditemukan" });
    if (registration.userId !== userId) return res.status(403).json({ error: "Bukan milikmu" });

    if (registration.progress !== FormProgress.DRAFT && registration.status !== RegStatus.REJECTED) {
      return res.status(403).json({ error: "Form terkunci, tidak bisa autosave" });
    }

    const existing = (registration.formData as any) || {};
    // shallow merge top-level sections
    const merged = { ...existing, ...payload };

    // otomatis ambil participantName & nisn dari merged.personal jika ada
    const personal = merged.personal || {};
    const participantName = personal.namaLengkap || registration.participantName;
    const nisn = personal.nisn ? String(personal.nisn) : registration.nisn;

    const updated = await prisma.registration.update({
      where: { id },
      data: { formData: merged, participantName, nisn },
    });

    await writeAudit(userId, "AUTOSAVE_REGISTRATION", `registrationId=${id}`);
    // do NOT create notification (autosave silenced)
    res.json({ message: "Autosave berhasil", registration: updated });
  } catch (err: any) {
    console.error("Error autosave:", err);
    res.status(500).json({ error: "Gagal melakukan autosave" });
  }
});

/**
 * PATCH /api/registrations/:id/submit
 * Kirim final -> set progress SUBMITTED & status PENDING
 */
router.patch("/:id/submit", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.userId;
    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) return res.status(404).json({ error: "Registrasi tidak ditemukan" });
    if (registration.userId !== userId) return res.status(403).json({ error: "Bukan milikmu" });

    if (registration.progress === FormProgress.SUBMITTED) return res.status(400).json({ error: "Pendaftaran sudah dikirim sebelumnya" });

    const formData = registration.formData as any;
    const missing = findMissingSections(formData);
    if (missing.length > 0) return res.status(400).json({ error: "Form belum lengkap", missing });

    // Ambil nama & nisn lagi
    const personal = formData?.personal || {};
    const participantName = personal.namaLengkap || registration.participantName;
    const nisn = personal.nisn ? String(personal.nisn) : registration.nisn;

    const updated = await prisma.registration.update({
      where: { id },
      data: { progress: FormProgress.SUBMITTED, status: RegStatus.PENDING, participantName, nisn },
      include: { user: true },
    });

    await prisma.notification.create({
      data: { userId, title: "Pendaftaran dikirim", message: "Data dan dokumenmu telah dikirim. Tunggu verifikasi dari admin." },
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
 * Detail (owner|admin)
 */
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const requester = req.user!;
    const registration = await prisma.registration.findUnique({
      where: { id },
      include: { user: true, documents: true },
    });
    if (!registration) return res.status(404).json({ error: "Registrasi tidak ditemukan" });

    if (registration.userId !== requester.userId && requester.role !== "ADMIN") {
      return res.status(403).json({ error: "Tidak punya akses ke registrasi ini" });
    }

    res.json(registration);
  } catch (err: any) {
    console.error("Error get registration:", err);
    res.status(500).json({ error: "Gagal mengambil data registrasi" });
  }
});

/**
 * GET /api/registrations/me
 * Ambil registration milik user yang sedang login
 * -> return hasRegistration false | object
 * -> selalu sertakan `canEdit`: true jika progress===DRAFT OR status===REJECTED
 */
router.get("/me", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const registration = await prisma.registration.findFirst({
      where: { userId },
      include: { documents: true },
    });

    if (!registration) return res.json({ hasRegistration: false });

    const canEdit = registration.progress === FormProgress.DRAFT || registration.status === RegStatus.REJECTED;

    const response: any = {
      hasRegistration: true,
      id: registration.id,
      status: registration.status,
      progress: registration.progress,
      adminNote: registration.adminNote,
      canEdit,
      documents: registration.documents ?? [],
    };

    // if canEdit (draft or rejected) we still return formData so frontend can prefill; if submitted, also return formData for viewing
    response.formData = registration.formData ?? {};

    return res.json(response);
  } catch (err: any) {
    console.error("Error get my registration:", err);
    res.status(500).json({ error: "Gagal mengambil registrasi Anda" });
  }
});

export default router;
