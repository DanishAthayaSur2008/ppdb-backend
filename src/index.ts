// src/index.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

import authRoutes from "./routes/auth";
import authResetRoutes from "./routes/authReset";
import registrationsRoutes from "./routes/registrations";
import documentsRoutes from "./routes/documents";
import adminRoutes from "./routes/admin";
import notificationRoutes from "./routes/notification";

const app = express();
const PORT = process.env.PORT || 4000;

// ===============================
// 1. TRUST PROXY (jika deploy ke vercel / railway / nginx)
// ===============================
app.set("trust proxy", 1);

// ===============================
// 2. CORS — AMAN & SUPPORT NEXT.JS
// ===============================
app.use(
  cors({
    origin: process.env.FRONTEND_URL || true, // ex: "https://ppdb-myschool.com"
    credentials: true,
  })
);

// ===============================
// 3. BODY PARSER
// ===============================
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// ===============================
// 4. COOKIE PARSER
// ===============================
app.use(cookieParser());

// ===============================
// 5. STATIC SERVE (uploads folder)
// ===============================
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), {
  maxAge: "1d",
  etag: true,
}));

// ===============================
// 6. ROUTING (ALL API PREFIXED WITH /api)
// ===============================
app.use("/api/auth", authRoutes);
app.use("/api/auth", authResetRoutes);
app.use("/api/registrations", registrationsRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);

// ===============================
// 7. HEALTH CHECK
// ===============================
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

// ===============================
// 8. GLOBAL ERROR HANDLER
// ===============================
app.use((err: any, req: express.Request, res: express.Response, next: Function) => {
  console.error("\n🔥 GLOBAL ERROR:", err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// ===============================
// 9. START SERVER
// ===============================
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT} (env: ${process.env.NODE_ENV || "dev"})`)
);
