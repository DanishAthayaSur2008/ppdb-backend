import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// ================= CONFIG =================
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// ================= TYPES ==================
export interface JwtPayload {
  userId: number;
  role: "USER" | "ADMIN"; // bisa ditambah role lain kalau perlu
}

// extend express Request supaya ada field user
export interface AuthRequest extends Request {
  user?: JwtPayload;
}


export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // format "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Token tidak ada" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Forbidden: Token tidak valid" });
    }
    req.user = decoded as JwtPayload; // simpan user ke request
    next();
  });
}


export function requireRole(role: "USER" | "ADMIN") {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized: User tidak terautentikasi" });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ error: `Forbidden: Hanya ${role} yang boleh mengakses` });
    }
    next();
  };
}
