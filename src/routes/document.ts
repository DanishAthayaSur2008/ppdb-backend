import express, { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PrismaClient, DocStatus, DocType } from "@prisma/client";
import { authenticateToken, AuthRequest, requireRole } from "../middleware/auth";

const router = express.Router();
const prisma = new PrismaClient();

// ========================
// 🔧 Konfigurasi Multer
// ========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../uploads/documents");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname.replace(/\s+/g, "_"));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Maks 10MB per file
});

// ========================
// 📤 Upload / Update Dokumen
// ========================
router.post(
  "/upload/:registrationId",
  authenticateToken,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { registrationId } = req.params;
      const { docType } = req.body;
      const file = req.file;

      if (!file) return res.status(400).json({ error: "File belum diunggah" });
      if (!docType) return res.status(400).json({ error: "Jenis dokumen (docType) wajib diisi" });

      // Validasi enum docType
      if (!Object.values(DocType).includes(docType as DocType)) {
        return res.status(400).json({ error: `Jenis dokumen ${docType} tidak valid.` });
      }

      // Pastikan user hanya bisa upload dokumen miliknya
      const registration = await prisma.registration.findUnique({
        where: { id: Number(registrationId) },
      });

      if (!registration || registration.userId !== req.user!.userId) {
        return res.status(403).json({ error: "Tidak punya akses ke pendaftaran ini" });
      }

      // Cek apakah dokumen jenis itu sudah ada
      const existing = await prisma.document.findUnique({
        where: {
          registrationId_docType: {
            registrationId: Number(registrationId),
            docType: docType as DocType,
          },
        },
      });

      // Jika sudah ada → update & hapus file lama
      if (existing) {
        const oldPath = path.join(__dirname, "../../uploads/documents", existing.fileName);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

        const updated = await prisma.document.update({
          where: {
            registrationId_docType: {
              registrationId: Number(registrationId),
              docType: docType as DocType,
            },
          },
          data: {
            fileName: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            status: DocStatus.PENDING,
            note: null,
            verifiedBy: null,
          },
        });

        return res.json({ message: "Dokumen berhasil diperbarui", document: updated });
      }

      // Jika belum ada → buat dokumen baru
      const newDoc = await prisma.document.create({
        data: {
          registrationId: Number(registrationId),
          docType: docType as DocType,
          fileName: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
      });

      return res.status(201).json({ message: "Dokumen berhasil diunggah", document: newDoc });
    } catch (err) {
      console.error("Upload Document Error:", err);
      return res.status(500).json({ error: "Gagal mengunggah dokumen" });
    }
  }
);

// ========================
// 📥 Get Semua Dokumen User
// ========================
router.get(
  "/:registrationId",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const { registrationId } = req.params;

      const registration = await prisma.registration.findUnique({
        where: { id: Number(registrationId) },
      });

      if (!registration || registration.userId !== req.user!.userId) {
        return res.status(403).json({ error: "Tidak punya akses ke pendaftaran ini" });
      }

      const docs = await prisma.document.findMany({
        where: { registrationId: Number(registrationId) },
        orderBy: { createdAt: "asc" },
      });

      return res.json(docs);
    } catch (err) {
      console.error("Get Document Error:", err);
      return res.status(500).json({ error: "Gagal mengambil data dokumen" });
    }
  }
);

// ========================
// 🧾 Admin Verifikasi Dokumen
// ========================
router.patch(
  "/verify/:id",
  authenticateToken,
  requireRole,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, note } = req.body;

      if (!Object.values(DocStatus).includes(status as DocStatus)) {
        return res.status(400).json({ error: "Status dokumen tidak valid" });
      }

      const updated = await prisma.document.update({
        where: { id: Number(id) },
        data: {
          status: status as DocStatus,
          note,
          verifiedBy: req.user!.userId,
        },
      });

      return res.json({ message: "Status dokumen diperbarui", document: updated });
    } catch (err) {
      console.error("Verify Document Error:", err);
      return res.status(500).json({ error: "Gagal memperbarui status dokumen" });
    }
  }
);

// ========================
// 🗑️ Hapus Dokumen (Admin)
// ========================
router.delete(
  "/:id",
  authenticateToken,
  requireRole,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const doc = await prisma.document.findUnique({ where: { id: Number(id) } });

      if (!doc) return res.status(404).json({ error: "Dokumen tidak ditemukan" });

      const filePath = path.join(__dirname, "../../uploads/documents", doc.fileName);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await prisma.document.delete({ where: { id: Number(id) } });

      return res.json({ message: "Dokumen berhasil dihapus" });
    } catch (err) {
      console.error("Delete Document Error:", err);
      return res.status(500).json({ error: "Gagal menghapus dokumen" });
    }
  }
);

export default router;
