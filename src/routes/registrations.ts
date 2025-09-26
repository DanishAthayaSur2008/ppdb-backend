// src/routes/registrations.ts
import { Router } from "express";
import prisma from "../prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * Create registration (user daftar sekolah)
 */
router.post("/registrations", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // tiap user cuma boleh punya 1 registration
    const existing = await prisma.registration.findFirst({ where: { userId } });
    if (existing) return res.status(400).json({ message: "Sudah ada registration" });

    const registration = await prisma.registration.create({ data: { userId } });
    return res.status(201).json({ registration });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * Lihat semua registration milik user
 */
router.get("/registrations/me", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    const regs = await prisma.registration.findMany({
      where: { userId },
      include: { documents: true },
    });
    return res.json({ registrations: regs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
