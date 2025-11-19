// src/routes/documents.ts
import { Router, Response } from "express";
import { PrismaClient, DocType, DocStatus, FormProgress, RegStatus } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";
import multer from "multer";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();
const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + "-" + file.originalname);
  },
});
const upload = multer({ storage });

function deleteFile(fileName: string | null) {
  if (!fileName) return;
  const fullPath = path.join(process.cwd(), "uploads", fileName);
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
}

function isValidDocumentType(value: string): value is DocType {
  return Object.values(DocType).includes(value as DocType);
}

/**
 * POST /api/documents/upload/:registrationId
 */
router.post("/upload/:registrationId", authenticateToken, upload.single("file"), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const registrationId = Number(req.params.registrationId);
    const { docType } = req.body;

    if (!req.file) return res.status(400).json({ error: "File wajib diupload" });
    if (!docType) return res.status(400).json({ error: "docType wajib diisi" });
    if (!isValidDocumentType(docType)) return res.status(400).json({ error: "docType tidak valid" });

    const reg = await prisma.registration.findUnique({ where: { id: registrationId } });
    if (!reg) return res.status(404).json({ error: "Registrasi tidak ditemukan" });
    if (reg.userId !== userId) return res.status(403).json({ error: "Tidak boleh upload milik orang lain" });

    // only allow upload when DRAFT or REJECTED (user cannot change after SUBMITTED)
    if (reg.progress !== FormProgress.DRAFT && reg.status !== RegStatus.REJECTED) {
      return res.status(403).json({ error: "Tidak bisa upload karena form sudah dikirim atau terverifikasi" });
    }

    const existing = await prisma.document.findUnique({
      where: { registrationId_docType: { registrationId, docType } },
    });

    if (existing) deleteFile(existing.fileName);

    const saved = await prisma.document.upsert({
      where: { registrationId_docType: { registrationId, docType } },
      update: {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        status: DocStatus.PENDING,
        note: null,
        verifiedBy: null,
      },
      create: {
        registrationId,
        docType: docType as DocType,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        status: DocStatus.PENDING,
      },
    });

    await prisma.notification.create({
      data: { userId, title: "Dokumen Terupload", message: `Dokumen ${docType} berhasil diupload` },
    });

    res.json({ message: "Upload berhasil", document: saved });
  } catch (err: any) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Gagal upload dokumen" });
  }
});

/**
 * GET /api/documents/:registrationId
 */
router.get("/:registrationId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const registrationId = Number(req.params.registrationId);
    const reg = await prisma.registration.findUnique({ where: { id: registrationId }, include: { documents: true } });
    if (!reg) return res.status(404).json({ error: "Registrasi tidak ditemukan" });
    if (reg.userId !== req.user!.userId && req.user!.role !== "ADMIN") return res.status(403).json({ error: "Tidak memiliki akses" });

    res.json(reg.documents);
  } catch (err: any) {
    console.error("Get documents error:", err);
    res.status(500).json({ error: "Gagal mengambil dokumen" });
  }
});

/**
 * PATCH /api/documents/verify/:documentId  (ADMIN)
 */
router.patch("/verify/:documentId", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const documentId = Number(req.params.documentId);
    const { status, note } = req.body;

    if (!["APPROVED", "REJECTED", "PENDING"].includes(status)) return res.status(400).json({ error: "Status dokumen tidak valid" });

    const doc = await prisma.document.update({
      where: { id: documentId },
      data: { status: status as DocStatus, note: note ?? null, verifiedBy: req.user!.userId },
      include: { registration: true },
    });

    await prisma.notification.create({
      data: {
        userId: doc.registration.userId,
        title: status === "APPROVED" ? "Dokumen Disetujui" : status === "REJECTED" ? "Dokumen Ditolak" : "Dokumen Ditinjau",
        message: status === "APPROVED" ? `Dokumen ${doc.docType} disetujui` : status === "REJECTED" ? `Dokumen ${doc.docType} ditolak. ${note ? "Catatan: " + note : ""}` : `Dokumen ${doc.docType} sedang diproses`,
      },
    });

    res.json({ message: "Status dokumen diperbarui", document: doc });
  } catch (err: any) {
    console.error("Verify error:", err);
    res.status(500).json({ error: "Gagal memverifikasi dokumen" });
  }
});

export default router;
