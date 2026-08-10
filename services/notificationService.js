// backend/services/notificationService.js
require('dotenv').config(); // Load environment variables first
const nodemailer = require('nodemailer');
const createCustomError = require('../utils/customError');
const logger = require('../utils/logger');

/**
 * Creates and returns a Nodemailer transporter with runtime env checks
 */
const getTransporter = () => {
  const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, ''); // Remove spaces from App Password

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // true for 465, false for other ports (587)
    auth: {
      user: process.env.SMTP_USER,
      pass: smtpPass,
    },
    tls: {
      rejectUnauthorized: false, // Avoid TLS/SSL verification issues in local environment
    },
  });
};

/**
 * Sends real email notification
 * @param {Object} options
 * @param {string} options.recipientEmail - Target recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.message - Plain text message body
 * @param {string} [options.html] - Optional HTML body
 */
const sendNotification = async ({ recipientEmail, subject, message, html }) => {
  try {
    // 🔍 Verification check: If environment variables are missing, fallback to console log
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      // console.log(`\n================ 🔔 MOCK NOTIFICATION ================`);
      // console.log(`To: ${recipientEmail}`);
      // console.log(`Subject: ${subject}`);
      // console.log(`Message: ${message}`);
      // console.log(`=====================================================\n`);

      logger.info(`[MOCK NOTIFICATION] To: ${recipientEmail} | Subject: ${subject} | Message: ${message}`);
      return;
    }

    const transporter = getTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || `"Incident Support" <${process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject: subject,
      text: message,
      html: html || `<p>${message.replace(/\n/g, '<br>')}</p>`,
    };

    const info = await transporter.sendMail(mailOptions);
    // console.log(`📧 Real Email Sent to ${recipientEmail} | Message ID: ${info.messageId}`);
    logger.info(`Real Email Sent to ${recipientEmail} | Message ID: ${info.messageId}`);
    return info;
  } catch (error) {
    // console.error('❌ Failed to send email notification:', error.message);
    logger.error(`Failed to send email notification: ${error.message}`);
    throw createCustomError(`Email notification failed: ${error.message}`, 500);
  }
};

module.exports = { sendNotification };