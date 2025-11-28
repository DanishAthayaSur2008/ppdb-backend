// src/modules/auth/resetPassword.service.ts
import { prisma } from "../../database/prisma";
import { mailtrapService } from "../notification/mailtrap.service";
import crypto from "crypto";
import bcrypt from "bcryptjs";

export const resetPasswordService = {
  // ======================================
  // REQUEST RESET PASSWORD
  // ======================================
  async requestReset(email: string, frontendUrl: string) {
    const GENERIC = {
      message: "Jika email terdaftar, link reset telah dikirim."
    };

    if (!email) return GENERIC;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return GENERIC;

    // Generate raw token
    const rawToken = crypto.randomBytes(32).toString("hex");

    // Hash for DB
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 15);

    // Save token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpires: expires
      }
    });

    const resetLink = `${frontendUrl}/verify?token=${rawToken}`;

    // Send email via Mailtrap Template
    try {
      await sendMailtrapTemplate({
        to: user.email,
        name: user.name,
        resetLink
      });
    } catch (err) {
      console.error("Email sending error:", err);
    }

    return GENERIC;
  },

  // ======================================
  // VERIFY TOKEN
  // ======================================
  async verifyToken(rawToken: string) {
    const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashed,
        resetTokenExpires: { gt: new Date() }
      }
    });

    return !!user;
  },

  // ======================================
  // RESET PASSWORD
  // ======================================
  async resetPassword(rawToken: string, newPassword: string) {
    const hashedTok = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedTok,
        resetTokenExpires: { gt: new Date() }
      }
    });

    if (!user) return false;

    const hashedPass = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPass,
        resetToken: null,
        resetTokenExpires: null
      }
    });

    return true;
  },

  // ======================================
  // DEBUG TOKEN (untuk Postman testing)
  // ======================================
  async debugToken(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { resetToken: true, resetTokenExpires: true }
    });
    return user;
  }
};

// ================================================================
// MAILTRAP TEMPLATE SENDER
// ================================================================
async function sendMailtrapTemplate(data: {
  to: string;
  name: string;
  resetLink: string;
}) {
  const API_TOKEN = process.env.MAILTRAP_API_TOKEN!;
  const TEMPLATE_UUID = process.env.MAILTRAP_TEMPLATE_UUID!;
  const SENDER = process.env.SMTP_FROM!;

  const payload = {
    template_uuid: TEMPLATE_UUID,
    template_variables: {
      name: data.name,
      reset_link: data.resetLink
    },
    to: [{ email: data.to }],
    from: { email: SENDER, name: "SPMB System" }
  };

  await fetch("https://send.api.mailtrap.io/api/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
}
