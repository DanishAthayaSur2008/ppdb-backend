import multer from "multer";
import path from "path";
import fs from "fs";

// Pastikan folder uploads ada
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// -----------------------------
// Konfigurasi Storage
// -----------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const safeName = file.originalname
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_.-]/g, "");
    cb(null, `${uniqueSuffix}-${safeName}${ext}`);
  },
});

// -----------------------------
// Validasi File
// -----------------------------
function fileFilter(req: any, file: Express.Multer.File, cb: any) {
  const allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Tipe file tidak diperbolehkan. Hanya PDF/JPG/PNG."));
  }
  cb(null, true);
}

// -----------------------------
// Limit ukuran
// -----------------------------
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2 MB
  },
});

export default upload;
