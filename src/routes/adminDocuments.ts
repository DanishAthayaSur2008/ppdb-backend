// src/routes/adminDocuments.ts
import { Router } from "express";
import prisma from "../prisma/client";
import { requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * PATCH /admin/documents/:docId/verify
 * body: { status: "APPROVED" | "REJECTED", note?: string }
 */
router.patch("/documents/:docId/verify", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const docId = Number(req.params.docId);
    const { status, note } = req.body;

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Status tidak valid" });
    }

    const updated = await prisma.document.update({
      where: { id: docId },
      data: {
        verificationStatus: status,
        verifiedBy: req.user?.userId ?? undefined,
        reviewedAt: new Date(),
        note: note ?? null
      }
    });

    // cek semua dokumen di registration
    const regId = updated.registrationId;
    const docs = await prisma.document.findMany({ where: { registrationId: regId } });

    const allApproved = docs.length > 0 && docs.every(d => d.verificationStatus === "APPROVED");
    if (allApproved) {
      await prisma.registration.update({ where: { id: regId }, data: { status: "VERIFIED" } });
    } else {
      // kalau ada REJECTED, bisa set registration jadi REJECTED (opsional)
      const anyRejected = docs.some(d => d.verificationStatus === "REJECTED");
      if (anyRejected) {
        await prisma.registration.update({ where: { id: regId }, data: { status: "REJECTED" } });
      } else {
        // tetap pending
        await prisma.registration.update({ where: { id: regId }, data: { status: "PENDING" } });
      }
    }

    return res.json({ updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
