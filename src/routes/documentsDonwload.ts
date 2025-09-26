// src/routes/documentsDownload.ts
import { Router } from "express";
import path from "path";
import prisma from "../prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/documents/:id/download", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ message: "Dokumen tidak ditemukan" });

    const registration = await prisma.registration.findUnique({ where: { id: doc.registrationId } });
    if (!registration) return res.status(404).json({ message: "Registrasi tidak ditemukan" });

    if (req.user?.role !== "ADMIN" && req.user?.userId !== registration.userId) {
      return res.status(403).json({ message: "Tidak diizinkan" });
    }

    const filePath = path.join(process.cwd(), doc.fileUrl.replace(/^\//, ""));
    return res.download(filePath, doc.originalName);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
