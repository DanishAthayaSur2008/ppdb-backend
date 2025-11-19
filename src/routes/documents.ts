// src/routes/documents.ts
import { Router, Response } from "express";
import { PrismaClient, DocType, DocStatus, FormProgress, RegStatus } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import multer from "multer";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const router = Router();

// ============================
// Multer Upload Setup
// ============================

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + "-" + file.originalname.replace(/\s+/g, "_"));
  },
});
const upload = multer({ storage });

// ============================
// Helpers
// ============================

function safeDelete(fileName: string | null) {
  if (!fileName) return;
  const filePath = path.join(uploadDir, fileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function isValidDocType(type: string): type is DocType {
  return Object.values(DocType).includes(type as DocType);
}

// ============================
// 1️⃣ USER UPLOAD DOKUMEN
// POST /api/documents/upload/:registrationId
// ============================

router.post(
  "/upload/:registrationId",
  authenticateToken,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const registrationId = Number(req.params.registrationId);
      if (isNaN(registrationId)) return res.status(400).json({ error: "ID registrasi tidak valid" });

      const userId = req.user!.userId;
      const { docType } = req.body;

      if (!req.file) return res.status(400).json({ error: "File wajib diupload" });
      if (!docType) return res.status(400).json({ error: "docType wajib diisi" });
      if (!isValidDocType(docType)) {
        return res.status(400).json({ error: "docType tidak valid", allowed: Object.values(DocType) });
      }

      const reg = await prisma.registration.findUnique({ where: { id: registrationId } });
      if (!reg) return res.status(404).json({ error: "Registrasi tidak ditemukan" });

      // Tidak boleh upload milik orang lain
      if (reg.userId !== userId) return res.status(403).json({ error: "Tidak boleh upload milik orang lain" });

      // Tidak boleh upload jika form bukan DRAFT atau REJECTED
      const canUpload =
        reg.progress === FormProgress.DRAFT || reg.status === RegStatus.REJECTED;

      if (!canUpload) {
        return res.status(403).json({
          error: "Form sudah dikirim atau diverifikasi – upload terkunci",
        });
      }

      // cek existing dokumen
      const existing = await prisma.document.findUnique({
        where: {
          registrationId_docType: {
            registrationId,
            docType,
          },
        },
      });

      // replace file jika sudah ada
      if (existing) safeDelete(existing.fileName);

      const saved = await prisma.document.upsert({
        where: {
          registrationId_docType: { registrationId, docType },
        },
        update: {
          fileName: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          status: DocStatus.PENDING,
          verifiedBy: null,
          note: null,
        },
        create: {
          registrationId,
          docType,
          fileName: req.file.filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          status: DocStatus.PENDING,
        },
      });

      // NOTIFIKASI: file terupload
      await prisma.notification.create({
        data: {
          userId,
          title: "Dokumen Terupload",
          message: `Dokumen ${docType} berhasil diupload`,
        },
      });

      res.json({ message: "Upload berhasil", document: saved });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Gagal upload dokumen" });
    }
  }
);

// ============================
// 2️⃣ GET Semua Dokumen User
// GET /api/documents/:registrationId
// ============================

router.get("/:registrationId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const registrationId = Number(req.params.registrationId);
    if (isNaN(registrationId)) return res.status(400).json({ error: "ID tidak valid" });

    const reg = await prisma.registration.findUnique({
      where: { id: registrationId },
      include: { documents: true },
    });

    if (!reg) return res.status(404).json({ error: "Registrasi tidak ditemukan" });

    if (reg.userId !== req.user!.userId && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Tidak memiliki akses" });
    }

    res.json(reg.documents);
  } catch (err) {
    console.error("Get docs error:", err);
    res.status(500).json({ error: "Gagal mengambil dokumen" });
  }
});

// ============================
// 3️⃣ ADMIN VERIFIKASI DOKUMEN
// PATCH /api/documents/verify/:documentId
// ============================

router.patch(
  "/verify/:documentId",
  authenticateToken,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const documentId = Number(req.params.documentId);
      if (isNaN(documentId)) return res.status(400).json({ error: "ID tidak valid" });

      const { status, note } = req.body;

      if (!["APPROVED", "REJECTED", "PENDING"].includes(status)) {
        return res.status(400).json({ error: "Status dokumen tidak valid" });
      }

      const doc = await prisma.document.update({
        where: { id: documentId },
        data: {
          status: status as DocStatus,
          note: note ?? null,
          verifiedBy: req.user!.userId,
        },
        include: { registration: true },
      });

      await prisma.notification.create({
        data: {
          userId: doc.registration.userId,
          title:
            status === "APPROVED"
              ? "Dokumen Disetujui"
              : status === "REJECTED"
              ? "Dokumen Ditolak"
              : "Dokumen Ditinjau",
          message:
            status === "APPROVED"
              ? `Dokumen ${doc.docType} telah disetujui`
              : status === "REJECTED"
              ? `Dokumen ${doc.docType} ditolak. ${note ? "Catatan: " + note : ""}`
              : `Dokumen ${doc.docType} sedang diperiksa`,
        },
      });

      res.json({ message: "Status dokumen diperbarui", document: doc });
    } catch (err) {
      console.error("Verify error:", err);
      res.status(500).json({ error: "Gagal memverifikasi dokumen" });
    }
  }
);

export default router;
