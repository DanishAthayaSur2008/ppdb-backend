// src/routes/notification.ts
import { Router, Response } from "express";
import { PrismaClient, NotificationType } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

/* ============================================
   1️⃣ GET semua notifikasi user (OWNER ONLY)
   GET /api/notifications
=============================================== */
router.get(
  "/",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      const notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      res.json(notifications);
    } catch (err) {
      console.error("Get notifications error:", err);
      res.status(500).json({ error: "Gagal mengambil notifikasi" });
    }
  }
);

/* ============================================
   2️⃣ Tandai notifikasi sebagai dibaca
   PATCH /api/notifications/read/:id
=============================================== */
router.patch(
  "/read/:id",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });

      const notif = await prisma.notification.findUnique({ where: { id } });
      if (!notif) return res.status(404).json({ error: "Notifikasi tidak ditemukan" });

      if (notif.userId !== req.user!.userId) {
        return res.status(403).json({ error: "Tidak boleh membaca notifikasi orang lain" });
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

      res.json(updated);
    } catch (err) {
      console.error("Read notification error:", err);
      res.status(500).json({ error: "Gagal menandai notifikasi" });
    }
  }
);

/* ============================================
   3️⃣ Tandai semua notifikasi sebagai dibaca
   PATCH /api/notifications/read-all
=============================================== */
router.patch(
  "/read-all",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.userId;

      await prisma.notification.updateMany({
        where: { userId },
        data: { isRead: true },
      });

      res.json({ message: "Semua notifikasi ditandai sebagai dibaca" });
    } catch (err) {
      console.error("Read-all notification error:", err);
      res.status(500).json({ error: "Gagal menandai semua notifikasi" });
    }
  }
);

/* ============================================
   4️⃣ ADMIN kirim notifikasi manual ke user
   POST /api/notifications/admin/send
=============================================== */
router.post(
  "/admin/send",
  authenticateToken,
  requireRole("ADMIN"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId, title, message, type } = req.body;

      if (!userId || !title || !message) {
        return res
          .status(400)
          .json({ error: "userId, title, dan message wajib diisi" });
      }

      const notif = await prisma.notification.create({
        data: {
          userId: Number(userId),
          title,
          message,
          type: type ?? NotificationType.ADMIN_NOTE,
        },
      });

      res.status(201).json({ message: "Notifikasi terkirim", notification: notif });
    } catch (err) {
      console.error("Admin send notification error:", err);
      res.status(500).json({ error: "Gagal mengirim notifikasi" });
    }
  }
);

/* ============================================
   END
=============================================== */

export default router;
