// src/routes/auth.ts
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import validator from "validator";

const router = express.Router();
const prisma = new PrismaClient();

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || "supersecret";
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || "superrefreshsecret";

const generateAccessToken = (user: any) =>
  jwt.sign({ userId: user.id, role: user.role }, ACCESS_TOKEN_SECRET, { expiresIn: "1d" });

const generateRefreshToken = (user: any) =>
  jwt.sign({ userId: user.id }, REFRESH_TOKEN_SECRET, { expiresIn: "7d" });

router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body;
    if (!email || !validator.isEmail(email)) return res.status(400).json({ message: "Format email tidak valid" });
    if (!password || password.length < 8) return res.status(400).json({ message: "Password minimal 8 karakter" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ message: "Email sudah digunakan" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, fullname: fullName || undefined, role: role || "USER" },
    });

    res.status(201).json({ message: "User berhasil dibuat", userId: user.id });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email dan password wajib diisi" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: "User tidak ditemukan" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Password salah" });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await prisma.user.update({ where: { id: user.id }, data: { refreshToken } });

    res.json({ accessToken, refreshToken, user: { id: user.id, email: user.email, fullname: user.fullname } });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Server error" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).end();

    const user = await prisma.user.findFirst({ where: { refreshToken } });
    if (!user) return res.status(403).end();

    jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, (err: any) => {
      if (err) return res.status(403).end();
      const newAccessToken = generateAccessToken(user);
      res.json({ accessToken: newAccessToken });
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Server error" });
  }
});

router.post("/logout", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "userId diperlukan" });
    await prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
    res.json({ message: "Logout berhasil" });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
