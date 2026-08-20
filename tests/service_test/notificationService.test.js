const nodemailer = require('nodemailer');
const createCustomError = require('../../utils/customError');
const logger = require('../../utils/logger');
const { sendNotification } = require('../../services/notificationService');

// Mocks
jest.mock('nodemailer');
jest.mock('../../utils/customError');
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

describe('notificationService', () => {
  const originalEnv = process.env;
  let mockSendMail;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };

    mockSendMail = jest.fn();
    nodemailer.createTransport.mockReturnValue({
      sendMail: mockSendMail,
    });

    createCustomError.mockImplementation((message, statusCode) => {
      const err = new Error(message);
      err.statusCode = statusCode;
      return err;
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('sendNotification', () => {
    test('should fallback to mock notification if SMTP_USER or SMTP_PASS is missing', async () => {
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      await sendNotification({
        recipientEmail: 'user@example.com',
        subject: 'Test Subject',
        message: 'Test Message',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[MOCK NOTIFICATION] To: user@example.com | Subject: Test Subject | Message: Test Message'
      );
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    test('should send email using transporter when environment variables are set', async () => {
      process.env.SMTP_USER = 'smtp_user@example.com';
      process.env.SMTP_PASS = ' secret pass ';
      process.env.SMTP_HOST = 'smtp.test.com';
      process.env.SMTP_PORT = '587';
      process.env.EMAIL_FROM = '"Custom Sender" <no-reply@example.com>';

      const mockInfo = { messageId: 'msg_12345' };
      mockSendMail.mockResolvedValue(mockInfo);

      const result = await sendNotification({
        recipientEmail: 'recipient@example.com',
        subject: 'Incident Alert',
        message: 'Line 1\nLine 2',
      });

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'smtp_user@example.com',
          pass: 'secretpass', // verify spaces were trimmed
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"Custom Sender" <no-reply@example.com>',
        to: 'recipient@example.com',
        subject: 'Incident Alert',
        text: 'Line 1\nLine 2',
        html: '<p>Line 1<br>Line 2</p>',
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Real Email Sent to recipient@example.com | Message ID: msg_12345'
      );
      expect(result).toEqual(mockInfo);
    });

    test('should use provided custom HTML content if passed in options', async () => {
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'pass';
      mockSendMail.mockResolvedValue({ messageId: 'msg_1' });

      const customHtml = '<h1>Heading</h1><p>Custom Body</p>';

      await sendNotification({
        recipientEmail: 'recipient@example.com',
        subject: 'HTML Email',
        message: 'Plain message',
        html: customHtml,
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: customHtml,
        })
      );
    });

    test('should fallback to default EMAIL_FROM and SMTP settings when optional env vars are omitted', async () => {
      process.env.SMTP_USER = 'support@example.com';
      process.env.SMTP_PASS = 'pass123';
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.EMAIL_FROM;

      mockSendMail.mockResolvedValue({ messageId: 'msg_default' });

      await sendNotification({
        recipientEmail: 'test@example.com',
        subject: 'Default Config',
        message: 'Testing defaults',
      });

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.gmail.com',
          port: 587,
        })
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '"Incident Support" <support@example.com>',
        })
      );
    });

    test('should log error and throw custom 500 error when sendMail fails', async () => {
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'pass';

      const mailError = new Error('Connection timed out');
      mockSendMail.mockRejectedValue(mailError);

      await expect(
        sendNotification({
          recipientEmail: 'test@example.com',
          subject: 'Error Case',
          message: 'This should fail',
        })
      ).rejects.toThrow('Email notification failed: Connection timed out');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send email notification: Connection timed out'
      );
      expect(createCustomError).toHaveBeenCalledWith(
        'Email notification failed: Connection timed out',
        500
      );
    });
  });
});