// src/routes/admin.ts
import { Router, Response } from "express";
import {
  PrismaClient,
  RegStatus,
  FormProgress,
  SelectionStage,
  SelectionResult,
} from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

// ==============================
// Helper: next stage validation
// ==============================

const STAGE_FLOW: SelectionStage[] = [
  "PENDAFTARAN",
  "SELEKSI_BERKAS",
  "TES_AKADEMIK",
  "WAWANCARA",
  "PSIKOTEST",
  "HOME_VISIT",
  "PENGUMUMAN",
];

function getNextStage(current: SelectionStage) {
  const idx = STAGE_FLOW.indexOf(current);
  if (idx === -1 || idx === STAGE_FLOW.length - 1) return null;
  return STAGE_FLOW[idx + 1];
}

// ========================================
// 1️⃣ ADMIN LIHAT SEMUA PENDAFTARAN
// GET /api/admin/registrations
// ========================================

router.get(
  "/registrations",
  authenticateToken,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await prisma.registration.findMany({
        include: {
          user: true,
          documents: true,
          stages: true,
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(data);
    } catch (err) {
      console.error("ADMIN list registrations error:", err);
      res.status(500).json({ error: "Gagal mengambil data" });
    }
  }
);

// ========================================
// 2️⃣ ADMIN LIHAT DETAIL PENDAFTARAN
// GET /api/admin/registrations/:id
// ========================================

router.get(
  "/registrations/:id",
  authenticateToken,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });

      const reg = await prisma.registration.findUnique({
        where: { id },
        include: {
          user: true,
          documents: true,
          stages: true,
        },
      });

      if (!reg) return res.status(404).json({ error: "Registrasi tidak ditemukan" });

      res.json(reg);
    } catch (err) {
      console.error("ADMIN get registration error:", err);
      res.status(500).json({ error: "Gagal mengambil detail pendaftaran" });
    }
  }
);

// =====================================================
// 3️⃣ ADMIN VERIFIKASI PENDAFTARAN (LULUS / TOLAK)
// PATCH /api/admin/verify/:id
// =====================================================

router.patch(
  "/verify/:id",
  authenticateToken,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });

      const { status, adminNote } = req.body;

      if (!["VERIFIED", "REJECTED"].includes(status)) {
        return res.status(400).json({ error: "Status tidak valid" });
      }

      const reg = await prisma.registration.findUnique({
        where: { id },
      });

      if (!reg) return res.status(404).json({ error: "Registrasi tidak ditemukan" });

      // === Aturan A (pilihan kamu) ===
      // REJECTED → user bisa edit ulang seluruh form
      // VERIFIED → form di-lock dan lanjut ke tahap SEL_BERKAS

      const nextStage =
        status === "VERIFIED" ? "SELEKSI_BERKAS" : "PENDAFTARAN"; // REJECTED kembali ke awal

      const updated = await prisma.registration.update({
        where: { id },
        data: {
          status: status as RegStatus,
          progress:
            status === "VERIFIED" ? FormProgress.LOCKED : FormProgress.DRAFT,
          stage: nextStage as SelectionStage,
          adminNote: adminNote ?? null,
          verifiedBy: req.user!.userId,
        },
      });

      // Notifikasi ke user
      await prisma.notification.create({
        data: {
          userId: reg.userId,
          title:
            status === "VERIFIED"
              ? "Pendaftaran Diverifikasi"
              : "Pendaftaran Ditolak",
          message:
            status === "VERIFIED"
              ? "Selamat! Pendaftaranmu diverifikasi. Menunggu seleksi berkas."
              : `Pendaftaranmu ditolak. Silakan perbaiki data dan kirim ulang.${adminNote ? " Catatan admin: " + adminNote : ""}`,
        },
      });

      res.json({ message: "Status verifikasi diperbarui", registration: updated });
    } catch (err) {
      console.error("ADMIN verify error:", err);
      res.status(500).json({ error: "Gagal memperbarui verifikasi" });
    }
  }
);

// =====================================================
// 4️⃣ ADMIN UPDATE TAHAP ALUR PENDAFTARAN
// PATCH /api/admin/stage/:id
// =====================================================

router.patch(
  "/stage/:id",
  authenticateToken,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });

      const { result, notes } = req.body;

      if (!["LULUS", "TIDAK_LULUS", "DALAM_PROSES"].includes(result)) {
        return res.status(400).json({ error: "Result tahap tidak valid" });
      }

      const reg = await prisma.registration.findUnique({
        where: { id },
      });

      if (!reg) return res.status(404).json({ error: "Registrasi tidak ditemukan" });

      const next = getNextStage(reg.stage);

      if (!next) return res.status(400).json({ error: "Tahap terakhir sudah tercapai" });

      // Restricted:
      // tidak boleh skip langsung 2 tahap
      // hanya boleh maju 1 level
      const updated = await prisma.registration.update({
        where: { id },
        data: {
          stage: next,
          selectionResult: result,
          adminNote: notes ?? null,
        },
      });

      // log history tahap
      await prisma.registrationStage.create({
        data: {
          registrationId: id,
          stageName: next,
          status: result,
          notes: notes ?? null,
          updatedBy: req.user!.userId,
        },
      });

      // notifikasi
      await prisma.notification.create({
        data: {
          userId: reg.userId,
          title: `Tahap ${next} diperbarui`,
          message: `Status pada tahap ${next}: ${result}`,
        },
      });

      res.json({ message: "Tahap diperbarui", registration: updated });
    } catch (err) {
      console.error("ADMIN stage error:", err);
      res.status(500).json({ error: "Gagal memperbarui tahap" });
    }
  }
);

// ========================================
// END
// ========================================

export default router;
