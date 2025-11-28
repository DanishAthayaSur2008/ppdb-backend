// src/modules/notification/mailtrap.service.ts

export const mailtrapService = {
  async sendTemplate(to: string, templateUUID: string, variables: any) {
    const url = "https://send.api.mailtrap.io/api/send";

    const payload = {
      from: {
        email: process.env.SMTP_FROM,
        name: "SPMB System"
      },
      to: [
        { email: to }
      ],
      template_uuid: templateUUID,
      template_variables: variables
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.MAILTRAP_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("Mailtrap error:", err);
        return false;
      }

      console.log("Email template sent to:", to);
      return true;

    } catch (error) {
      console.error("Mailtrap send error:", error);
      return false;
    }
  }
};
