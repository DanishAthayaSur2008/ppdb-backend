// src/utils/authHelpers.ts
import crypto from "crypto";
import nodemailer from "nodemailer";

export function generateResetTokenPlain(length = 48) {
  return crypto.randomBytes(length).toString("hex");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function sendResetEmail(to: string, resetUrl: string) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"PPDB SMK TI Bazma" <${process.env.SMTP_USER}>`,
    to,
    subject: "Reset Password Akun PPDB",
    html: `
      <p>Halo,</p>
      <p>Kami menerima permintaan untuk mereset password akunmu.</p>
      <p>Klik link berikut untuk mengatur ulang password (berlaku ${process.env.RESET_TOKEN_EXPIRE_MINUTES} menit):</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>Abaikan jika kamu tidak meminta reset password.</p>
    `,
  });
}
