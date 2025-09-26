import { Router } from "express";
import prisma from "../prisma/client";
import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

// ENV secret JWT
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // cek apakah email sudah dipakai
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email sudah terdaftar" });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // buat user baru
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role || "USER", // default USER
      },
    });

    res.status(201).json({ message: "User berhasil dibuat", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error server" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // cari user berdasarkan email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: "Email atau password salah" });
    }

    // cek password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(400).json({ message: "Email atau password salah" });
    }

    // buat JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" } // token berlaku 1 hari
    );

    res.json({ message: "Login berhasil", token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error server" });
  }
});

export default router;
