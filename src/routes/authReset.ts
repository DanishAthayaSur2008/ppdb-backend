import express from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// ==================== ⚡ Anti-Spam Rate Limiter ====================
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 3, // maksimal 3x per jam per IP
  message: {
    error: "Terlalu banyak permintaan reset password. Coba lagi setelah 1 jam.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ==================== 📩 REQUEST RESET PASSWORD ====================
router.post("/forgot", forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email wajib diisi" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: "Email tidak terdaftar" });

    // generate token random dan hash-nya dengan SHA256
    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const expire = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpires: expire,
      },
    });

    const resetLink = `${process.env.APP_URL}/reset-password?token=${token}&id=${user.id}`;

    // === Kirim pakai Mailtrap Template ===
    const response = await fetch("https://send.api.mailtrap.io/api/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MAILTRAP_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { email: process.env.SMTP_FROM, name: "Tim SPMB SMK TI Bazma" },
        to: [{ email: user.email }],
        template_uuid: process.env.MAILTRAP_TEMPLATE_UUID, // UUID template dari Mailtrap
        template_variables: {
          user_email: user.email,
          reset_link: resetLink,
          app_name: "SPMB SMK TI Bazma",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Mailtrap API Error:", errText);
      throw new Error("Gagal mengirim email template");
    }

    console.log(`📩 Template reset password dikirim ke: ${user.email}`);
    res.json({ message: "Email reset password telah dikirim" });

  } catch (error: any) {
    console.error("Error forgot password:", error);
    res.status(500).json({ message: "Gagal mengirim email reset password" });
  }
});

// ==================== 🧭 HALAMAN FORM RESET PASSWORD ====================
router.get("/reset-password", (req, res) => {
  const token = req.query.token;
  const id = req.query.id;

  if (!token || !id) {
    return res.status(400).send("<h3>Token tidak ditemukan atau tidak valid.</h3>");
  }

  res.send(`
    <html>
      <head>
        <title>Reset Password | PPDB SMK TI Bazma</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: #f5f5f5;
            padding: 30px;
            color: #333;
          }
          .container {
            background: white;
            max-width: 400px;
            margin: auto;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          }
          input, button {
            width: 100%;
            padding: 10px;
            margin-top: 10px;
            font-size: 14px;
          }
          button {
            background: #007BFF;
            color: white;
            border: none;
            cursor: pointer;
            border-radius: 5px;
          }
          button:hover {
            background: #0056b3;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Reset Password</h2>
          <form action="/api/auth/reset" method="POST">
            <input type="hidden" name="id" value="${id}" />
            <input type="hidden" name="token" value="${token}" />
            <label>Password baru:</label>
            <input type="password" name="password" required />
            <button type="submit">Reset Password</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

// ==================== 🔐 RESET PASSWORD FINAL ====================
router.post("/reset", async (req, res) => {
  try {
    const { id, token, password } = req.body;
    if (!id || !token || !password) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    const user = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!user || !user.resetToken) {
      return res.status(400).json({ message: "Token tidak valid" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // validasi token & kadaluarsa
    if (
      user.resetToken !== hashedToken ||
      !user.resetTokenExpires ||
      user.resetTokenExpires < new Date()
    ) {
      return res.status(400).json({ message: "Token tidak valid atau sudah kadaluarsa" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    console.log(`✅ Password user ${user.email} berhasil direset`);
    return res.redirect(`${process.env.FRONTEND_URL}/login?reset=success`);
  } catch (error: any) {
    console.error("Error reset password:", error);
    return res.status(500).json({ message: "Terjadi kesalahan internal pada server" });
  }
});

export default router;
