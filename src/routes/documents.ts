// src/routes/documents.ts
import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import prisma from "../prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error("Tipe file tidak diperbolehkan"));
    cb(null, true);
  }
});

router.post("/:registrationId/upload", authenticateToken, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    const { registrationId } = req.params;
    const { type } = req.body;
    const file = (req as any).file;
    if (!file) return res.status(400).json({ message: "File tidak ditemukan" });

    const registration = await prisma.registration.findFirst({
      where: { id: Number(registrationId), userId: Number(user?.userId) },
    });

    if (!registration) return res.status(403).json({ message: "Registrasi tidak ditemukan atau bukan milik user" });

    const created = await prisma.document.create({
      data: {
        registrationId: registration.id,
        type: type as any,
        fileUrl: `/uploads/${file.filename}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        verificationStatus: "PENDING"
      },
    });

    return res.status(201).json({ message: "Dokumen berhasil diupload", document: created });
  } catch (error: any) {
    console.error(error);
    if (error.message && error.message.includes("Tipe file")) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Error server" });
  }
});

export default router;
