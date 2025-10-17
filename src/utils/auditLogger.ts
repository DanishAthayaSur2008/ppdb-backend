import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

/**
 * Catat aktivitas penting ke database.
 * @param req Request express (agar bisa ambil IP, path, dll)
 * @param userId ID user (boleh null)
 * @param action Nama aksi (contoh: "UPLOAD_DOCUMENT", "VERIFY_REGISTRATION")
 * @param details Deskripsi tambahan (opsional)
 */
export async function logAudit(
  req: any,
  userId: number | null,
  action: string,
  details?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        details: details ?? null,
        method: req.method || "UNKNOWN",
        path: req.originalUrl || "-",
        ip: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
      },
    });
  } catch (err) {
    console.error("Gagal mencatat audit log:", err);
  }
}
