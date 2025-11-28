// src/modules/notification/email.service.ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

export const emailService = {
  async sendMail(to: string, subject: string, html: string) {
    try {
      const info = await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject,
        html
      });

      console.log("Email sent:", info.messageId);
      return true;

    } catch (error) {
      console.error("Email sending error:", error);
      return false;
    }
  }
};
