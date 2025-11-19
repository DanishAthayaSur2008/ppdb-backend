// src/index.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import dotenv from "dotenv";

import authRoutes from "./routes/auth";
import authResetRoutes from "./routes/authReset";
import registrationsRoutes from "./routes/registrations";
import documentsRoutes from "./routes/documents";
import adminRoutes from "./routes/admin";
import notificationRoutes from "./routes/notification";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;

// =====================================================
// 1. TRUST PROXY (wajib jika pakai VPS + reverse proxy)
// =====================================================
app.set("trust proxy", 1);

// =====================================================
// 2. CORS — menggunakan ENV FRONTEND_URL + localhost
// =====================================================
const allowedOrigins = [
  process.env.FRONTEND_URL,          // domain produksi
  process.env.DEV_FRONTEND_URL,      // localhost dev
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser (curl, postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn("❌ Blocked by CORS:", origin);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// =====================================================
// 3. BODY PARSER
// =====================================================
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// =====================================================
// 4. COOKIE PARSER
// =====================================================
app.use(cookieParser());

// =====================================================
// 5. STATIC FILES (for uploads)
// =====================================================
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), "uploads"), {
    maxAge: "1d",
    etag: true,
  })
);

// =====================================================
// 6. ROUTES
// =====================================================
app.use("/api/auth", authRoutes);
app.use("/api/auth", authResetRoutes);
app.use("/api/registrations", registrationsRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);

// =====================================================
// 7. HEALTH CHECK
// =====================================================
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    timestamp: Date.now(),
    env: process.env.NODE_ENV,
  });
});

// =====================================================
// 8. GLOBAL ERROR HANDLER
// =====================================================
app.use((err: any, req: express.Request, res: express.Response, next: Function) => {
  console.error("🔥 GLOBAL ERROR:", err);

  if (res.headersSent) return next(err);

  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// =====================================================
// 9. START SERVER
// =====================================================
app.listen(PORT, () =>
  console.log(🚀 Server running on port ${PORT} (env: ${process.env.NODE_ENV || "dev"}))
);