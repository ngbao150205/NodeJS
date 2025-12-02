// config/mailer.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT || 587),
  secure: false, // TLS STARTTLS
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

async function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || process.env.MAIL_USER;
  return transporter.sendMail({
    from,
    to,
    subject,
    text,
    html: html || text,
  });
}

module.exports = { sendMail };
