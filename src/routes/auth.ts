// src/routes/auth.ts
import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authenticateToken, AuthRequest } from "../middleware/auth";

const prisma = new PrismaClient();
const router = Router();

// ========================
// Helper: JWT
// ========================
const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET!;

function generateAccessToken(user: any) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    ACCESS_SECRET,
    { expiresIn: "15m" }
  );
}

function generateRefreshToken(user: any) {
  return jwt.sign(
    { userId: user.id },
    REFRESH_SECRET,
    { expiresIn: "7d" }
  );
}

// ========================
// REGISTER
// ========================
router.post("/register", async (req, res) => {
  try {
    const { fullname, email, password } = req.body;

    if (!fullname || !email || !password) {
      return res.status(400).json({ error: "Semua field wajib diisi" });
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(400).json({ error: "Email sudah digunakan" });

    const hashed = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        fullname,
        email,
        password: hashed,
      },
    });

    res.status(201).json({ message: "Registrasi berhasil, silakan login" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Gagal membuat akun" });
  }
});

// ========================
// LOGIN
// ========================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: "Email atau password salah" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ error: "Email atau password salah" });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Simpan refresh token di DB
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    // Set cookie httpOnly agar aman
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false, // Ubah ke true jika pakai HTTPS
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Login berhasil",
      accessToken,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Gagal login" });
  }
});

// ========================
// REFRESH TOKEN
// ========================
router.post("/refresh", async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.status(401).json({ error: "Token tidak ditemukan" });

    const user = await prisma.user.findFirst({ where: { refreshToken: token } });
    if (!user) {
      res.clearCookie("refreshToken");
      return res.status(403).json({ error: "Refresh token invalid" });
    }

    jwt.verify(token, REFRESH_SECRET, (err: any, decoded: any) => {
      if (err) {
        res.clearCookie("refreshToken");
        return res.status(403).json({ error: "Refresh token kadaluarsa" });
      }

      const accessToken = generateAccessToken(user);
      res.json({ accessToken });
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(500).json({ error: "Gagal memperbarui token" });
  }
});

// ========================
// LOGOUT
// ========================
router.post("/logout", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Hapus refresh token dari DB
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    res.clearCookie("refreshToken");
    res.json({ message: "Logout berhasil" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Gagal logout" });
  }
});

// ========================
// GET USER PROFILE
// ========================
router.get("/me", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullname: true, email: true, role: true },
    });

    res.json(user);
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ error: "Gagal mengambil data user" });
  }
});

export default router;
