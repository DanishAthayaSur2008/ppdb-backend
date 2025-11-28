import { prisma } from "../../database/prisma";
import { hashPassword, comparePassword } from "../../utils/hash";
import { signToken } from "../../utils/jwt";

export const authService = {
  // ============================
  // USER REGISTER
  // ============================
  async register(data: { email: string; name: string; password: string }) {
    // Cek email sudah digunakan atau belum
    const exists = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (exists) {
      return { error: "Email already used" };
    }

    // Hash password (WAJIB pakai await!)
    const hashed = await hashPassword(data.password);

    // Simpan user baru
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: hashed,
        role: "USER"
      }
    });

    // Generate token JWT
    const token = await signToken({
      id: user.id,
      role: user.role
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  },

  // ============================
  // LOGIN USER & ADMIN
  // ============================
  async login(data: { email: string; password: string }) {
    // Cari user berdasarkan email
    const user = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (!user) {
      return { error: "Invalid email or password" };
    }

    // Cocokkan password
    const valid = await comparePassword(data.password, user.passwordHash);
    if (!valid) {
      return { error: "Invalid email or password" };
    }

    // Generate token
    const token = await signToken({
      id: user.id,
      role: user.role
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  }
};
