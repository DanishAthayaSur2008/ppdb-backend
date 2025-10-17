import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

// Ambil semua notifikasi user login
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json(notifications);
  } catch (error) {
    console.error("Error get notifications:", error);
    res.status(500).json({ error: "Gagal mengambil notifikasi" });
  }
});


router.patch("/:id/read", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    res.json({ message: "Notifikasi ditandai sebagai dibaca" });
  } catch (error) {
    res.status(500).json({ error: "Gagal update notifikasi" });
  }
});

export default router;
