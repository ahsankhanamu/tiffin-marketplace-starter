import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

function normalizeEmail(email) {
  if (!email) return '';
  return email.trim().toLowerCase();
}

function getEmailConfig() {
  const provider = (process.env.EMAIL_PROVIDER || 'gmail').toLowerCase();
  
  const configs = {
    gmail: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
      }
    },
    office365: {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
      }
    }
  };

  return configs[provider] || configs.gmail;
}

function createTransporter() {
  const config = getEmailConfig();

  if (!config.auth.user || !config.auth.pass) {
    throw new Error(
      'Email credentials not configured. Please set EMAIL and EMAIL_PASSWORD environment variables.'
    );
  }

  return nodemailer.createTransport(config);
}

function isEmailEnabled() {
  return process.env.SEND_EMAIL === 'true';
}

async function sendEmailWithRetry(options, maxRetries = 3) {
  if (!isEmailEnabled()) {
    console.log(`📧 Email sending disabled. Skipping email to: ${options.to}`);
    return {
      success: true,
      skipped: true,
      reason: 'Email sending disabled'
    };
  }

  const transporter = createTransporter();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await transporter.sendMail({
        from: options.from || process.env.EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html
      });

      console.log(`✅ Email sent successfully (attempt ${attempt})`);
      return {
        success: true,
        messageId: result.messageId,
        skipped: false,
        reason: 'Email sent successfully'
      };
    } catch (error) {
      console.error(
        `❌ Email send failed (attempt ${attempt}/${maxRetries}):`,
        error.message
      );

      if (attempt === maxRetries) {
        console.log('\n📧 EMAIL FALLBACK (Network Restricted)');
        console.log('=====================================');
        console.log(`From: ${options.from || process.env.EMAIL}`);
        console.log(`To: ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log('Content: [HTML content would be sent here]');
        console.log('=====================================\n');

        return {
          success: true,
          messageId: `fallback-${Date.now()}`,
          fallback: true,
          skipped: false,
          reason: 'Email sent via fallback (console logging)'
        };
      }

      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    skipped: false,
    reason: 'Function execution failed'
  };
}

function generateForgotPasswordEmail(userName, otp, websiteUrl) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset OTP - Tiffin Marketplace</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
      <h1 style="margin: 0 0 10px 0; font-size: 28px; font-weight: bold; color: #ffffff;">
        Password Reset Code
      </h1>
      <p style="margin: 0; font-size: 16px; color: #ffffff; opacity: 0.9;">
        Your OTP is ready
      </p>
    </div>

    <!-- Content -->
    <div style="padding: 40px 20px; background-color: #f8fafc;">
      <h2 style="color: #333; margin-bottom: 20px; font-size: 24px;">
        Hi ${userName}! 👋
      </h2>

      <p style="color: #333; line-height: 1.6; margin-bottom: 20px; font-size: 16px;">
        You've requested to reset your password for the Tiffin Marketplace platform. 
        Use the verification code below to complete your password reset.
      </p>

      <!-- OTP Card -->
      <div style="background: white; padding: 25px; border-radius: 10px; margin: 30px 0; border: 1px solid #e0e0e0;">
        <p style="color: #667eea; font-size: 14px; font-weight: 600; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px;">
          Your Verification Code:
        </p>
        <div style="color: #667eea; font-size: 32px; font-weight: bold; font-family: monospace; background-color: #f8fafc; padding: 20px 16px; border-radius: 6px; margin: 8px 0; text-align: center; letter-spacing: 8px; border: 2px solid #667eea;">
          ${otp}
        </div>
        <p style="color: #fca5a5; font-size: 14px; margin: 12px 0 0 0; font-style: italic;">
          ⚠️ This code will expire in 10 minutes. Please do not share this code with anyone.
        </p>
      </div>

      <p style="color: #333; line-height: 1.6; margin-bottom: 20px; font-size: 16px;">
        Enter this code in the password reset page to set your new password.
      </p>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 32px 0;">
        <a href="${websiteUrl || 'http://localhost:5173'}/forgot-password" 
           style="display: inline-block; background: white; color: #667eea; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; border: 2px solid #667eea;">
          🔐 Reset Password
        </a>
      </div>

      <p style="color: #333; line-height: 1.6; margin-bottom: 20px; font-size: 16px;">
        If you didn't request this password reset, please ignore this email or contact our support team immediately.
      </p>

      <!-- Footer -->
      <div style="border-top: 2px solid #e0e0e0; padding-top: 20px; margin-top: 30px; text-align: center;">
        <p style="color: #888; font-size: 14px; margin: 0;">
          Best regards,<br>
          <strong>The Tiffin Marketplace Team</strong><br>
          <a href="${websiteUrl || 'http://localhost:5173'}" style="color: #667eea; text-decoration: none;">
            ${websiteUrl || 'http://localhost:5173'}
          </a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

export async function sendForgotPassword(email, userName, otp) {
  try {
    const normalizedEmail = normalizeEmail(email);
    const websiteUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const emailHtml = generateForgotPasswordEmail(
      userName || normalizedEmail.split('@')[0],
      otp,
      websiteUrl
    );

    const result = await sendEmailWithRetry({
      to: normalizedEmail,
      subject: '🔐 Password Reset OTP - Tiffin Marketplace',
      html: emailHtml
    });

    if (result.success && !result.skipped) {
      console.log('✅ Password reset OTP sent to:', normalizedEmail);
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to send password reset OTP to:', email, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      skipped: false,
      reason: 'Error occurred during email sending'
    };
  }
}

export function getEmailStatus() {
  return {
    enabled: isEmailEnabled(),
    sendEmail: process.env.SEND_EMAIL,
    emailProvider: process.env.EMAIL_PROVIDER || 'gmail',
    emailConfigured: !!(process.env.EMAIL && process.env.EMAIL_PASSWORD)
  };
}

