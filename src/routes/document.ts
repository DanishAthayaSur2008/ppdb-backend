import { Router, Response } from "express";
import { PrismaClient, DocStatus } from "@prisma/client";
import { FormProgress, RegStatus } from "@prisma/client";
import { authenticateToken, AuthRequest, requireRole } from "../middleware/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

const prisma = new PrismaClient();
const router = Router();



const uploadFolder = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true });
}

// ========================================================
// 🧰 Multer Setup (validasi file + penamaan unik)
// ========================================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadFolder);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, uniqueSuffix + "_" + safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB max per file
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".jpg", ".jpeg", ".png", ".pdf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedTypes.includes(ext)) {
      return cb(new Error("Hanya file JPG, PNG, dan PDF yang diperbolehkan!"));
    }
    cb(null, true);
  },
});

// ========================================================
// 📌 1️⃣ Upload Dokumen Baru (User)
// ========================================================
router.post(
  "/:registrationId/upload",
  authenticateToken,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { registrationId } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: "File tidak ditemukan" });
      }

      // Cek kepemilikan registrasi
      const reg = await prisma.registration.findUnique({
      where: { id: Number(registrationId) },
        });

      if (!reg) {
      return res.status(404).json({ error: "Registrasi tidak ditemukan" });
      }

      if (reg.userId !== req.user!.userId) {
        return res.status(403).json({ error: "Tidak boleh upload dokumen untuk registrasi ini" });
      }

if (reg.progress === FormProgress.SUBMITTED || reg.status === RegStatus.VERIFIED) {
  return res.status(403).json({
    error: "Pendaftaran sudah dikirim, tidak bisa upload dokumen baru.",
  });
}

      const document = await prisma.document.create({
        data: {
          registrationId: Number(registrationId),
          fileUrl: `/uploads/${req.file.filename}`,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          status: "PENDING",
        },
      });

      // Kirim notifikasi ke admin (opsional)
      await prisma.notification.create({
        data: {
          userId: reg.userId,
          title: "Upload Dokumen Baru",
          message: `Dokumen baru diunggah: ${req.file.originalname}`,
        },
      });

      res.json({ message: "Upload berhasil", document });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Gagal upload dokumen", detail: error.message });
    }
  }
);

// ========================================================
// 📌 6️⃣ Upload Banyak Foto Rumah (max 7 file, hanya untuk "foto_rumah")
// ========================================================
router.post(
  "/:registrationId/multi-upload", // ⚠️ ubah agar cocok dengan preflightFull.cjs
  authenticateToken,
  upload.array("files", 7),
  async (req: AuthRequest, res: Response) => {
    try {
      const { registrationId } = req.params;

      const reg = await prisma.registration.findUnique({
        where: { id: Number(registrationId) },
      });

      if (!reg || reg.userId !== req.user!.userId) {
        return res.status(403).json({ error: "Tidak punya izin untuk upload" });
      }

      if (reg.progress === "SUBMITTED" || reg.status === "VERIFIED") {
        return res.status(403).json({ error: "Pendaftaran terkunci, tidak bisa upload." });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "Tidak ada file yang diunggah" });
      }

      // Simpan semua file dan kembalikan daftar hasil
      const uploaded = await Promise.all(
        files.map((file) =>
          prisma.document.create({
            data: {
              registrationId: Number(registrationId),
              fileUrl: `/uploads/${file.filename}`,
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              status: "PENDING",
            },
          })
        )
      );

      // Buat notifikasi
      await prisma.notification.create({
        data: {
          userId: reg.userId,
          title: "Upload Foto Rumah",
          message: `Berhasil mengunggah ${uploaded.length} foto rumah.`,
        },
      });

      res.json({
        message: "Upload banyak foto berhasil",
        uploaded,
        count: uploaded.length,
      });
    } catch (error: any) {
      console.error("Multi-upload error:", error);
      res.status(500).json({
        error: "Gagal upload banyak file",
        detail: error.message,
      });
    }
  }
);


// ========================================================
// 📌 2️⃣ Ambil Semua Dokumen Milik Registrasi (User)
// ========================================================
router.get("/:registrationId", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { registrationId } = req.params;

    const reg = await prisma.registration.findUnique({
      where: { id: Number(registrationId) },
    });

    if (!reg || reg.userId !== req.user!.userId) {
      return res.status(403).json({ error: "Tidak boleh melihat dokumen registrasi ini" });
    }

    const documents = await prisma.document.findMany({
      where: { registrationId: Number(registrationId) },
    });

    res.json(documents);
  } catch (error: any) {
    res.status(500).json({ error: "Gagal mengambil dokumen", detail: error.message });
  }
});

// ========================================================
// 📌 3️⃣ Verifikasi Dokumen (Admin Only)
// ========================================================
router.patch("/:id/verify", authenticateToken, requireRole("ADMIN"), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ error: "Status tidak valid" });
    }

    const document = await prisma.document.findUnique({
      where: { id: Number(id) },
      include: { registration: true },
    });

    if (!document) {
      return res.status(404).json({ error: "Dokumen tidak ditemukan" });
    }

    const updatedDoc = await prisma.document.update({
      where: { id: Number(id) },
      data: {
        status: status as DocStatus,
        verifiedBy: req.user!.userId,
      },
    });

    // 🔔 Kirim notifikasi ke user
    await prisma.notification.create({
      data: {
        userId: document.registration.userId,
        title: "Status Dokumen Diperbarui",
        message:
          status === "APPROVED"
            ? `Selamat! Dokumen '${document.originalName}' telah disetujui.`
            : `Dokumen '${document.originalName}' ditolak. Silakan perbaiki dan upload ulang.`,
      },
    });

    res.json({ message: "Dokumen diverifikasi", document: updatedDoc });
  } catch (error: any) {
    console.error("Verifikasi error:", error);
    res.status(500).json({ error: "Gagal verifikasi dokumen", detail: error.message });
  }
});

// ========================================================
// 📌 4️⃣ Reupload Dokumen (User mengganti file lama yang ditolak)
// ========================================================
router.patch(
  "/:documentId/reupload",
  authenticateToken,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { documentId } = req.params;

      const document = await prisma.document.findUnique({
        where: { id: Number(documentId) },
        include: { registration: true },
      });

      if (!document) {
        return res.status(404).json({ error: "Dokumen tidak ditemukan" });
      }
      
      if (document.registration.progress === "SUBMITTED" || document.registration.status === "VERIFIED") {
      return res.status(403).json({
      error: "Tidak bisa mengganti dokumen karena pendaftaran sudah dikirim.",
      });
    }


      if (document.registration.userId !== req.user!.userId) {
        return res.status(403).json({ error: "Tidak memiliki izin untuk mengganti dokumen ini" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "File baru tidak ditemukan" });
      }

      // Hapus file lama dari folder uploads
      const oldPath = path.join(uploadFolder, path.basename(document.fileUrl));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

      // Update dokumen
      const updatedDoc = await prisma.document.update({
        where: { id: Number(documentId) },
        data: {
          fileUrl: `/uploads/${req.file.filename}`,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          status: "PENDING",
          verifiedBy: null, // reset status verifikasi
        },
      });

      // 🔔 Kirim notifikasi ke admin
      await prisma.notification.create({
        data: {
          userId: document.registration.userId,
          title: "Reupload Dokumen",
          message: `Pengguna telah mengunggah ulang dokumen '${document.originalName}'.`,
        },
      });

      res.json({ message: "Reupload berhasil", document: updatedDoc });
    } catch (error: any) {
      console.error("Reupload error:", error);
      res.status(500).json({ error: "Gagal mengganti dokumen", detail: error.message });
    }
  }
);

// ========================================================
// 📌 5️⃣ Error Handler (Multer & umum)
// ========================================================
router.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: "Ukuran file terlalu besar (max 3MB)" });
  } else if (err.message.includes("JPG") || err.message.includes("PNG") || err.message.includes("PDF")) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: "Server error", detail: err.message });
});

export default router;
