import { prisma } from "../../database/prisma";

export const dashboardService = {
  async getProvinceStats() {
    const sections = await prisma.formSection.findMany({
      where: { sectionNumber: 1 },
      select: { answers: true }
    });

    const stats: Record<string, number> = {};

    for (const s of sections) {
      if (!s.answers) continue;

      const ans = s.answers as Record<string, any>;

      // Ambil key provinsi (berbagai kemungkinan)
      let province =
        ans["province"] ||
        ans["Province"] ||
        ans["provinsi"] ||
        ans["asal_provinsi"];

      if (!province || typeof province !== "string") continue;

      // Normalisasi provinsi
      province = province.trim().toUpperCase();

      // Hitung
      stats[province] = (stats[province] || 0) + 1;
    }

    return stats;
  }
};
