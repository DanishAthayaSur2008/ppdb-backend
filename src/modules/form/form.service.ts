import { prisma } from "../../database/prisma";
import { writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const formService = {
  // ===================================================
  // 1. START FORM (membuat form baru atau ambil existing)
  // ===================================================
  async start(userId: string) {
    let form = await prisma.form.findFirst({
      where: { userId }
    });

    // Jika user sudah submit form, tidak boleh buat baru
    if (form && form.status !== "DRAFT" && form.status !== "REJECTED") {
      return { error: "Form already submitted. You cannot start a new form." };
    }

    // Jika belum ada form → buat baru
    if (!form) {
      form = await prisma.form.create({
        data: { userId, status: "DRAFT" }
      });

      // buat 7 section kosong
      for (let i = 1; i <= 7; i++) {
        await prisma.formSection.create({
          data: {
            formId: form.id,
            sectionNumber: i,
            answers: {}
          }
        });
      }
    }

    return form;
  },

  // ===================================================
  // 2. GET MY FORM (user melihat form + notes)
  // ===================================================
  async getMyForm(userId: string) {
    return prisma.form.findFirst({
      where: { userId },
      include: {
        sections: true,
        documents: true,
        registrationStatus: true,
        adminNotes: true
      }
    });
  },

  // ===================================================
  // 3. AUTOSAVE SECTION
  // diperbolehkan jika status = DRAFT atau REJECTED
  // ===================================================
  async saveSection(formId: string, sectionNumber: number, answers: any, userId: string) {
    const form = await prisma.form.findFirst({
      where: { id: formId, userId }
    });

    if (!form) return { error: "Not allowed" };

    // form terkunci kecuali DRAFT atau REJECTED
    if (form.status !== "DRAFT" && form.status !== "REJECTED")
      return { error: "Form cannot be edited right now" };

    return prisma.formSection.updateMany({
      where: { formId, sectionNumber },
      data: { answers }
    });
  },

  // ===================================================
  // 4. UPLOAD DOCUMENT (multipart + validation)
  // diperbolehkan jika status = DRAFT atau REJECTED
  // ===================================================
  async uploadDocument(formId: string, form: any, userId: string) {
    const file = form.file;

    if (!file) return { error: "No file uploaded" };

    const fieldName = form.fieldName;
    const sectionNumber = Number(form.sectionNumber);

    if (!fieldName || !sectionNumber) {
      return { error: "fieldName and sectionNumber are required" };
    }

    const formRecord = await prisma.form.findFirst({
      where: { id: formId, userId }
    });

    if (!formRecord) return { error: "Not allowed" };

    // hanya boleh upload di DRAFT atau REJECTED
    if (formRecord.status !== "DRAFT" && formRecord.status !== "REJECTED")
      return { error: "Cannot upload after submission" };

    // ========== batasan ukuran file ==========
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return { error: "File too large. Maximum 5 MB allowed." };
    }

    // ========== batasan tipe file ==========
    const allowedMime = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowedMime.includes(file.type)) {
      return { error: "Invalid file type. Only PDF, PNG, JPG are allowed." };
    }

    // ========== hanya 1 file per fieldName ==========
    const exists = await prisma.document.findFirst({
      where: { formId, fieldName }
    });

    if (exists) {
      return { error: `Document for '${fieldName}' already uploaded.` };
    }

    // ========== simpan ke local storage ==========
    const ext = file.name.split(".").pop();
    const filename = crypto.randomUUID() + "." + ext;

    const uploadPath = path.join(
      process.cwd(),
      "uploads",
      "documents",
      filename
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(uploadPath, buffer);

    // ========== simpan ke database ==========
    const doc = await prisma.document.create({
      data: {
        formId,
        fieldName,
        sectionNumber,
        fileUrl: "/uploads/documents/" + filename
      }
    });

    return {
      message: "File uploaded successfully",
      document: doc
    };
  },

  // ===================================================
  // 5. SUBMIT FORM  (DRAFT / REJECTED → PENDING)
  // Tambahan: INIT WORKFLOW
  // ===================================================
  async submit(formId: string, userId: string) {
    const form = await prisma.form.findFirst({
      where: { id: formId, userId }
    });

    if (!form) return { error: "Not allowed" };

    // hanya boleh submit dari DRAFT atau REJECTED
    if (form.status !== "DRAFT" && form.status !== "REJECTED")
      return { error: "You cannot submit the form right now" };

    // hapus semua catatan admin sebelumnya
    await prisma.adminNote.deleteMany({
      where: { formId }
    });

    // reset registrationStatus menjadi PENDING
    await prisma.registrationStatus.upsert({
      where: { formId },
      update: { status: "PENDING", note: null },
      create: { formId, status: "PENDING" }
    });

    // ======================================================
    // 🌟 INIT WORKFLOW USER (otomatis setelah submit pertama)
    // ======================================================
    const existingStages = await prisma.workflowStage.findMany({
      where: { userId }
    });

    if (existingStages.length === 0) {
      await prisma.workflowStage.createMany({
        data: [
          { userId, stage: "SELEKSI_BERKAS" },
          { userId, stage: "TES_AKADEMIK" },
          { userId, stage: "WAWANCARA" },
          { userId, stage: "TES_PSIKOTEST" },
          { userId, stage: "HOME_VISIT" },
          { userId, stage: "PENGUMUMAN_FINAL" },
        ]
      });
    }

    // update form menjadi PENDING
    return prisma.form.update({
      where: { id: formId },
      data: {
        status: "PENDING",
        submittedAt: new Date()
      }
    });
  }
};
