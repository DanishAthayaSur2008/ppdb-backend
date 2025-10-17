import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { FormProgress, RegStatus } from "@prisma/client";
import { authenticateToken, AuthRequest } from "../middleware/auth";
import {
  participantSchema,
  achievementSchema,
  parentSchema,
  housingSchema,
  healthSchema,
  consentSchema,
} from "../validators/registrationValidator";

const prisma = new PrismaClient();
const router = Router();

/**
 * STEP 1 - Buat Registrasi Awal
 */
router.post("/", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.registration.findFirst({
      where: { userId: req.user!.userId },
    });

    if (existing) {
      return res.status(400).json({ error: "User sudah memiliki registrasi" });
    }

    const registration = await prisma.registration.create({
      data: {
        userId: req.user!.userId,
        status: "PENDING",
        progress: "DRAFT",
        stage: "PENDAFTARAN",
      },
    });

    res.json({ message: "Registrasi berhasil dibuat", registration });
  } catch (error) {
    console.error("Error create registration:", error);
    res.status(500).json({ error: "Gagal membuat registrasi" });
  }
});

/**
 * STEP 2 - Isi / Update Section (Participant, Achievements, Parents, Housing, Health, Consent)
 * Mirip seperti auto-save
 */
const sections = {
  participant: participantSchema,
  achievements: achievementSchema,
  parents: parentSchema,
  housing: housingSchema,
  health: healthSchema,
  consent: consentSchema,
};

for (const [section, schema] of Object.entries(sections)) {
  router.post(`/:id/${section}`, authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const registration = await prisma.registration.findUnique({ where: { id } });

      // 🔒 Cek kepemilikan
      if (!registration || registration.userId !== req.user!.userId) {
        return res.status(403).json({ error: "Registrasi tidak ditemukan atau bukan milikmu" });
      }

      // 🔒 Cegah edit jika form sudah dikirim atau diverifikasi
      if (
        registration.progress === FormProgress.SUBMITTED ||
        registration.status === RegStatus.VERIFIED
      ) {
        return res.status(403).json({ error: "Form sudah dikirim dan tidak dapat diedit lagi." });
      }

      // ✅ Validasi dan simpan data
      const data = schema.parse(req.body);
      const tableName =
        section === "participant"
          ? "participantData"
          : section === "achievements"
          ? "achievementData"
          : section === "parents"
          ? "parentData"
          : section === "housing"
          ? "housingData"
          : section === "health"
          ? "healthData"
          : "consentData";

      const record = await (prisma as any)[tableName].upsert({
        where: { registrationId: id },
        update: data,
        create: { registrationId: id, ...data },
      });

      // 🔔 Notifikasi perubahan data
      await prisma.notification.create({
        data: {
          userId: req.user!.userId,
          title: `Data ${section} diperbarui`,
          message: `Bagian ${section} berhasil disimpan.`,
        },
      });

      res.json({ message: `Data ${section} berhasil disimpan`, data: record });
    } catch (error: any) {
      if (error.errors) {
        return res.status(400).json({ error: "Validasi gagal", details: error.errors });
      }
      console.error(`Error save ${section}:`, error);
      res.status(500).json({ error: `Gagal menyimpan data ${section}` });
    }
  });
}


/**
 * STEP 2.5 - Submit pendaftaran (lock form)
 */
router.patch("/:id/submit", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const registration = await prisma.registration.findUnique({ where: { id } });

    // 1️⃣ Cek apakah registrasi ada
    if (!registration) {
      return res.status(404).json({ error: "Registrasi tidak ditemukan" });
    }

    // 2️⃣ Pastikan hanya pemiliknya yang bisa submit
    if (registration.userId !== req.user!.userId) {
      return res.status(403).json({ error: "Tidak punya akses ke registrasi ini" });
    }

    // 3️⃣ Cegah jika form sudah dikirim atau diverifikasi admin
    if (
      registration.progress === FormProgress.SUBMITTED ||
      registration.status === RegStatus.VERIFIED
    ) {
      return res.status(403).json({ error: "Form sudah dikirim dan tidak dapat diedit lagi." });
    }

    // 4️⃣ Update status dan progress
    const updated = await prisma.registration.update({
      where: { id },
      data: {
        progress: FormProgress.SUBMITTED,
        status: RegStatus.PENDING,
      },
    });

    // 5️⃣ Kirim notifikasi ke user
    await prisma.notification.create({
      data: {
        userId: registration.userId,
        title: "Pendaftaran dikirim ✅",
        message: "Data dan dokumenmu telah dikirim. Menunggu verifikasi admin.",
      },
    });

    res.json({ message: "Pendaftaran berhasil dikirim", registration: updated });
  } catch (error: any) {
    console.error("Error submit:", error);
    res.status(500).json({ error: "Gagal mengirim pendaftaran" });
  }
});



/**
 * STEP 3 - Ambil Detail Registrasi Lengkap
 */
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const registration = await prisma.registration.findUnique({
      where: { id: Number(id) },
      include: {
        participant: true,
        achievements: true,
        parents: true,
        housing: true,
        health: true,
        consent: true,
        documents: true,
      },
    });

    if (!registration) return res.status(404).json({ error: "Registrasi tidak ditemukan" });
    if (registration.userId !== req.user!.userId && req.user!.role !== "ADMIN") {
      return res.status(403).json({ error: "Tidak punya akses ke registrasi ini" });
    }

    res.json(registration);
  } catch (error) {
    console.error("Error get registration:", error);
    res.status(500).json({ error: "Gagal mengambil data registrasi" });
  }
});

/**
 * STEP 4 - Auto-save Global (PUT)
 */
router.put("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const registration = await prisma.registration.findUnique({ where: { id } });

    // 🔒 Cek kepemilikan
    if (!registration || registration.userId !== req.user!.userId) {
      return res.status(403).json({ error: "Registrasi tidak ditemukan atau bukan milikmu" });
    }

    // 🔒 Cegah auto-save jika form sudah dikirim atau diverifikasi
    if (
      registration.progress === FormProgress.SUBMITTED ||
      registration.status === RegStatus.VERIFIED
    ) {
      return res.status(403).json({ error: "Form sudah dikirim, tidak dapat diedit lagi." });
    }

    // ✅ Validasi tiap bagian yang dikirim (parsial)
    const parsedData: any = {};
    if (req.body.participant) parsedData.participant = participantSchema.parse(req.body.participant);
    if (req.body.achievements) parsedData.achievements = achievementSchema.parse(req.body.achievements);
    if (req.body.parents) parsedData.parents = parentSchema.parse(req.body.parents);
    if (req.body.housing) parsedData.housing = housingSchema.parse(req.body.housing);
    if (req.body.health) parsedData.health = healthSchema.parse(req.body.health);
    if (req.body.consent) parsedData.consent = consentSchema.parse(req.body.consent);

    // 🔄 Simpan data baru
    const updated = await prisma.registration.update({
      where: { id },
      data: {
        participant: parsedData.participant
          ? { upsert: { create: parsedData.participant, update: parsedData.participant } }
          : undefined,
        achievements: parsedData.achievements
          ? { upsert: { create: parsedData.achievements, update: parsedData.achievements } }
          : undefined,
        parents: parsedData.parents
          ? { upsert: { create: parsedData.parents, update: parsedData.parents } }
          : undefined,
        housing: parsedData.housing
          ? { upsert: { create: parsedData.housing, update: parsedData.housing } }
          : undefined,
        health: parsedData.health
          ? { upsert: { create: parsedData.health, update: parsedData.health } }
          : undefined,
        consent: parsedData.consent
          ? { upsert: { create: parsedData.consent, update: parsedData.consent } }
          : undefined,
      },
    });

    res.json({ message: "Auto-save berhasil: data pendaftaran disimpan.", updated });
  } catch (error: any) {
    console.error("Error auto-save:", error);
    res.status(500).json({ error: "Gagal melakukan auto-save" });
  }
});


/**
 * STEP 5 - Submit Form
 */
router.patch("/:id/submit", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const registration = await prisma.registration.findUnique({ where: { id } });

    if (!registration) {
      return res.status(404).json({ error: "Registrasi tidak ditemukan" });
    }

    if (registration.userId !== req.user!.userId) {
      return res.status(403).json({ error: "Tidak punya akses ke registrasi ini" });
    }

    // 🚫 Tidak boleh submit ulang jika sudah SUBMITTED atau sudah diverifikasi
    if (
      registration.progress === FormProgress.SUBMITTED ||
      registration.status === RegStatus.VERIFIED
    ) {
      return res.status(403).json({
        error: "Pendaftaran sudah dikirim dan tidak dapat dikirim ulang.",
      });
    }

    // ✅ Update progress dan status menjadi SUBMITTED dan PENDING
    const updated = await prisma.registration.update({
      where: { id },
      data: {
        progress: FormProgress.SUBMITTED,
        status: RegStatus.PENDING,
      },
    });

    // 🔔 Kirim notifikasi ke user
    await prisma.notification.create({
      data: {
        userId: registration.userId,
        title: "Pendaftaran dikirim ✅",
        message: "Data dan dokumenmu telah dikirim. Menunggu verifikasi admin.",
      },
    });

    res.json({ message: "Pendaftaran berhasil dikirim", registration: updated });
  } catch (error: any) {
    console.error("Error submit:", error);
    res.status(500).json({ error: "Gagal mengirim pendaftaran" });
  }
});


export default router;
