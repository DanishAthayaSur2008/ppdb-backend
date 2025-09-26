
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// tipe data isi token
export interface JwtPayload {
  userId: number;
  role: string;
}

// extend express request supaya ada field user
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// middleware cek token
export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // format "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ message: "Token tidak ada" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Token tidak valid" });
    }
    req.user = decoded as JwtPayload; // simpan data user ke request
    next();
  });
}

// middleware khusus admin
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "User tidak terautentikasi" });
  }

  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ message: "Hanya admin yang boleh mengakses" });
  }

  next();
}