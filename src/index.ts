import dotenv from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import path from "path";
import { PrismaClient } from "@prisma/client";

// 🧩 Import routes
import authRoutes from "./routes/auth";
import registrationRoutes from "./routes/registrations";
import adminRoutes from "./routes/admin";
import documentRoutes from "./routes/document";
import notificationsRoutes from "./routes/notifications";
import { logAudit } from "./utils/auditLogger";

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// ==============================
// 🔧 Middleware dasar
// ==============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🛡️ Security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// ==============================
// 🌍 CORS Configuration (User + Admin Frontend)
// ==============================
const allowedOrigins = [
  "http://localhost:3000",                // Local development
  "https://ppdb-user.vercel.app",         // Frontend user
  "https://ppdb-admin.vercel.app",        // Frontend admin
  "https://ppdb.example.com",             // Optional custom domain
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        if (process.env.NODE_ENV === "development") {
          console.warn(`🚫 CORS blocked: ${origin}`);
        }
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ✅ Handle preflight CORS request
app.options("*", cors());

// ==============================
// ⚡ Rate limiting (anti brute-force)
// ==============================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 80, // maksimal per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Terlalu banyak permintaan, coba lagi nanti." },
});
app.use("/api/", apiLimiter);

// ==============================
// 🧾 Logger (morgan)
// ==============================
app.use(morgan("combined"));

// ==============================
// 📂 Serve static uploads
// ==============================
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ==============================
// 🧭 ROUTES
// ==============================
app.use("/api/auth", authRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/notifications", notificationsRoutes);

// ==============================
// 🧠 Global Audit Log Middleware
// ==============================
app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.method !== "GET" && req.url.startsWith("/api/")) {
      const userId = (req as any).user?.userId ?? null;
      const details = `${req.method} ${req.url}`;
      await logAudit(req, userId, "API_REQUEST", details);
    }
  } catch (err) {
    console.warn("⚠️ Audit log skipped:", (err as any).message);
  }
  next();
});


app.get("/", (req: Request, res: Response) => {
  res.send("✅ PPDB Backend is running securely and optimized! horeee");
});

app.get("/api/health", async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`; // test database connection
    res.json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", message: "Database not reachable" });
  }
});


app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Global Error:", err);
  res.status(500).json({ error: "Terjadi kesalahan internal pada server." });
});


process.on("SIGTERM", async () => {
  console.log("🧹 Closing Prisma connection...");
  await prisma.$disconnect();
  process.exit(0);
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT} (${process.env.NODE_ENV || "development"})`);
});
