// src/routes/auth.ts
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import validator from "validator";

const router = express.Router();
const prisma = new PrismaClient();

// ambil secret dari .env
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || "supersecret";
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || "superrefreshsecret";

// helper buat bikin token
const generateAccessToken = (user: any) => {
  return jwt.sign(
    { userId: user.id, role: user.role },
    ACCESS_TOKEN_SECRET,
    { expiresIn: "15m" }
  );
};

const generateRefreshToken = (user: any) => {
  return jwt.sign(
    { userId: user.id },
    REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" } // refresh token umur panjang
  );
};

// ================== REGISTER ==================
router.post("/register", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // 🔎 Validasi email
    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ message: "Format email tidak valid" });
    }

    // validasi panjang password minimal 8
    if (!password || password.length < 8) {
      return res.status(400).json({ message: "Password minimal 8 karakter" });
    }

    // cek kalau email sudah dipakai
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: "Email sudah digunakan" });
    }

    // hash password
    const hashed = await bcrypt.hash(password, 10);

    // simpan user baru
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        role: role || "USER",
      },
    });

    res.status(201).json({ message: "User berhasil dibuat", userId: user.id });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ================== LOGIN ==================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email dan password wajib diisi" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: "User tidak ditemukan" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Password salah" });

    // buat token
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.json({ accessToken, refreshToken });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ================== REFRESH TOKEN ==================
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.sendStatus(401);

    const user = await prisma.user.findFirst({ where: { refreshToken } });
    if (!user) return res.sendStatus(403);

    jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, (err: any) => {
      if (err) return res.sendStatus(403);

      const newAccessToken = generateAccessToken(user);
      res.json({ accessToken: newAccessToken });
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ================== LOGOUT ==================
router.post("/logout", async (req, res) => {
  try {
    const { userId } = req.body;

    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    res.json({ message: "Logout berhasil" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
