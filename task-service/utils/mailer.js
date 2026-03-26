const nodemailer = require("nodemailer");

const hasSmtpConfig = () =>
  Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.EMAIL_FROM
  );

const buildTransporter = () => {
  if (!hasSmtpConfig()) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendMail = async ({ to, subject, text }) => {
  const transporter = buildTransporter();
  if (!transporter) {
    console.warn("SMTP is not configured. Email not sent:", { to, subject });
    return { sent: false, reason: "SMTP not configured" };
  }

  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
  });

  return { sent: true, messageId: info.messageId };
};

module.exports = { sendMail, hasSmtpConfig };
