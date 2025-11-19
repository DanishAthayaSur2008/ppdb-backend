// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    userId: number;
    role: "USER" | "ADMIN";
  };
}

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET || "dev-secret";

// ===============================
// Middleware Authenticate JWT
// ===============================
export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Token tidak ditemukan" });
    }

    jwt.verify(token, ACCESS_SECRET, (err: any, decoded: any) => {
      if (err) {
        return res.status(401).json({ error: "Token tidak valid atau kadaluarsa" });
      }

      req.user = {
        userId: decoded.userId,
        role: decoded.role,
      };

      next();
    });
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(500).json({ error: "Gagal memverifikasi token" });
  }
}

// ===============================
// Middleware Require Role
// ===============================
export function requireRole(role: "ADMIN" | "USER") {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Tidak terautentikasi" });
      }

      if (req.user.role !== role) {
        return res.status(403).json({ error: "Akses ditolak" });
      }

      next();
    } catch (err) {
      console.error("Role check error:", err);
      return res.status(500).json({ error: "Gagal memproses role" });
    }
  };
}

// ===============================
// Middleware Require Role Multiple
// ex: requireRoles(["ADMIN", "USER"])
// ===============================
export function requireRoles(roles: ("USER" | "ADMIN")[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Tidak terautentikasi" });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: "Akses ditolak" });
      }

      next();
    } catch (err) {
      console.error("Role array check error:", err);
      return res.status(500).json({ error: "Gagal memproses role" });
    }
  };
}
