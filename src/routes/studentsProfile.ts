import { Router } from "express";
import prisma from "../prisma/client";
import { authenticateToken } from "../middleware/auth";

const router = Router();

/**
 * Isi / Update Data Diri Calon Siswa
 */
router.post("/", authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user; // dari middleware
    const {
      fullName,
      nisn,
      nik,
      birthPlace,
      birthDate,
      address,
      province,
      city,
      phone,
      socialMedia,
      previousSchool,
      npsn,
      graduationYear,
      siblingsStatus,
      parentStatus,
      familyStatus,
      livingWith,
      socialAid,
    } = req.body;

    // cek apakah sudah ada profile
    const existingProfile = await prisma.studentProfile.findUnique({
      where: { userId: user.userId },
    });

    if (existingProfile) {
      // update
      const updated = await prisma.studentProfile.update({
        where: { userId: user.userId },
        data: {
          fullName,
          nisn,
          nik,
          birthPlace,
          birthDate: new Date(birthDate),
          address,
          province,
          city,
          phone,
          socialMedia,
          previousSchool,
          npsn,
          graduationYear,
          siblingsStatus,
          parentStatus,
          familyStatus,
          livingWith,
          socialAid,
        },
      });
      return res.json({ message: "Profile berhasil diperbarui", profile: updated });
    } else {
      // create
      const profile = await prisma.studentProfile.create({
        data: {
          userId: user.userId,
          fullName,
          nisn,
          nik,
          birthPlace,
          birthDate: new Date(birthDate),
          address,
          province,
          city,
          phone,
          socialMedia,
          previousSchool,
          npsn,
          graduationYear,
          siblingsStatus,
          parentStatus,
          familyStatus,
          livingWith,
          socialAid,
        },
      });
      return res.status(201).json({ message: "Profile berhasil dibuat", profile });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error server" });
  }
});

/**
 * Lihat Data Diri Sendiri
 */
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = (req as any).user;
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: user.userId },
    });

    if (!profile) {
      return res.status(404).json({ message: "Profile belum diisi" });
    }

    res.json(profile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error server" });
  }
});

export default router;
