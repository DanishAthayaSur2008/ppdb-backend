// src/routes/auth.reset.ts
import express from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: "Terlalu banyak permintaan reset password. Coba lagi setelah 1 jam." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/forgot", forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email wajib diisi" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: "Email tidak terdaftar" });

    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const expire = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: hashedToken, resetTokenExpires: expire },
    });

    // Use FRONTEND_URL for the link. Fallback to APP_URL for backward compat.
    const frontend = process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:3000";
    const resetLink = `${frontend.replace(/\/$/, "")}/reset-password?token=${token}&id=${user.id}`;

    // send via Mailtrap API (ensure envs defined)
    if (!process.env.MAILTRAP_API_TOKEN || !process.env.MAILTRAP_TEMPLATE_UUID) {
      console.warn("MAILTRAP env not fully configured. Reset link:", resetLink);
      // For dev: return link in response so you can check in dev environment
      return res.json({ message: "Reset link (dev)", resetLink });
    }

    const response = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MAILTRAP_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { email: process.env.SMTP_FROM, name: "Tim SPMB" },
        to: [{ email: user.email }],
        template_uuid: process.env.MAILTRAP_TEMPLATE_UUID,
        template_variables: {
          user_email: user.email,
          reset_link: resetLink,
          app_name: process.env.APP_NAME || "SPMB",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Mailtrap API Error:", errText);
      throw new Error("Gagal mengirim email template");
    }

    res.json({ message: "Email reset password telah dikirim" });
  } catch (error: any) {
    console.error("Error forgot password:", error);
    res.status(500).json({ message: "Gagal mengirim email reset password" });
  }
});

router.get("/reset-password", (req, res) => {
  const token = req.query.token;
  const id = req.query.id;
  if (!token || !id) return res.status(400).send("<h3>Token tidak ditemukan atau tidak valid.</h3>");

  res.send(`
    <html>
      <body>
        <form action="/api/auth/reset" method="POST">
          <input type="hidden" name="id" value="${id}" />
          <input type="hidden" name="token" value="${token}" />
          <label>Password baru:</label>
          <input type="password" name="password" required />
          <button type="submit">Reset Password</button>
        </form>
      </body>
    </html>
  `);
});

router.post("/reset", async (req, res) => {
  try {
    const { id, token, password } = req.body;
    if (!id || !token || !password) return res.status(400).json({ message: "Data tidak lengkap" });

    const user = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!user || !user.resetToken) return res.status(400).json({ message: "Token tidak valid" });

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    if (user.resetToken !== hashedToken || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      return res.status(400).json({ message: "Token tidak valid atau sudah kadaluarsa" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, resetToken: null, resetTokenExpires: null },
    });

    // Redirect to frontend login page with param
    const frontend = process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:3000";
    return res.redirect(`${frontend.replace(/\/$/, "")}/?reset=success`);
  } catch (error: any) {
    console.error("Error reset password:", error);
    return res.status(500).json({ message: "Terjadi kesalahan internal pada server" });
  }
});

export default router;
