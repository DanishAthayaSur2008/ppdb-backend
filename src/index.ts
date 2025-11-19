// src/index.ts
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import authResetRoutes from "./routes/authReset";
import registrationsRoutes from "./routes/registration";
import documentsRoutes from "./routes/documents";
import adminRoutes from "./routes/admin";
import notificationRoutes from "./routes/notification";
import path from "path";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// static uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// mount routes
app.use("/api/auth", authRoutes);
app.use("/api/auth", authResetRoutes); // contains /forgot /reset
app.use("/api/registrations", registrationsRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);

// health
app.get("/health", (req, res) => res.json({ ok: true }));

// global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
