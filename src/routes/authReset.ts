// src/routes/authReset.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const router = Router();

// =============================
// ENV
// =============================
const APP_URL = process.env.APP_URL || "http://localhost:3000"; // FRONTEND URL
const TOKEN_EXPIRES_MINUTES = 15;

// =============================
// REQUEST RESET PASSWORD
// =============================
router.post("/forgot", async (req, res) => {
  try {
    const { email } = req.body;

    // ALWAYS respond success (security best practice)
    const genericResponse = {
      message: "Jika email terdaftar, link reset telah dikirim.",
    };

    if (!email) return res.status(200).json(genericResponse);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(200).json(genericResponse);

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + TOKEN_EXPIRES_MINUTES);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires: expires,
      },
    });

    // FINAL RESET LINK
    const link = `${APP_URL}/reset-password?token=${resetToken}`;

    console.log("RESET LINK:", link);

    // TODO: integrate real email service (SendGrid/Mailgun)
    // For now, return generic response
    return res.status(200).json(genericResponse);

  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ error: "Gagal memproses permintaan." });
  }
});

// =============================
// VERIFY TOKEN VALID
// =============================
router.get("/reset/verify", async (req, res) => {
  try {
    const { token } = req.query;

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token as string,
        resetTokenExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ valid: false, error: "Token tidak valid atau kadaluarsa." });
    }

    return res.json({ valid: true });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ error: "Gagal verifikasi token." });
  }
});

// =============================
// RESET PASSWORD
// =============================
router.post("/reset", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token dan password wajib diisi." });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: "Token salah atau sudah kadaluarsa." });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    return res.json({ message: "Password berhasil direset, silakan login." });

  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ error: "Gagal mereset password." });
  }
});

export default router;
