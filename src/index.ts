import dotenv from "dotenv";
dotenv.config();
import express from "express";
import path from "path";
import authRoutes from "./routes/auth";
import studentProfileRoutes from "./routes/studentsProfile";
import documentsRoutes from "./routes/documents";
import adminDocumentsRoutes from "./routes/adminDocuments";
import downloadRoutes from "./routes/documentsDonwload";
import { authenticateToken, requireAdmin } from "./middleware/auth";

const app = express();
app.use(express.json());

// serve file upload
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// routes
app.use("/api/auth", authRoutes);
app.use("/api/students/profile", studentProfileRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/admin", adminDocumentsRoutes);
app.use("/api", downloadRoutes);

// contoh endpoint user
app.get("/api/me", authenticateToken, (req, res) => {
  res.json({ message: "Halo user yang login!", user: (req as any).user });
});

// contoh endpoint admin
app.get("/api/admin/secret", authenticateToken, requireAdmin, (req, res) => {
  res.json({ message: "Halo Admin! Kamu bisa lihat data sensitif di sini." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
