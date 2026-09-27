import nodemailer from 'nodemailer';
import { Order, SiteSettings, DeliveryInformation } from '../src/types';
import { getSettings } from './db';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  accepted?: string[];
  rejected?: string[];
  response?: string;
  error?: string;
  simulation?: boolean;
}

/**
 * Tests and verifies the active SMTP connection and authentication status on demand.
 * SECURITY: Never logs or prints passwords, app passwords, or secrets.
 */
export async function verifyEmailTransporter(): Promise<{
  connection: 'SUCCESS' | 'FAILED';
  authentication: 'SUCCESS' | 'FAILED';
  provider: string;
  details?: string;
}> {
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || '').trim().replace(/\s+/g, '');
  if (gmailPass && !gmailPass.includes('xxxx')) {
    const gmailUser = (process.env.GMAIL_USER || 'oforir74444@gmail.com').trim();
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });
      await transporter.verify();
      console.log('[Email Transporter] SMTP connection: SUCCESS');
      console.log('[Email Transporter] SMTP authentication: SUCCESS');
      return {
        connection: 'SUCCESS',
        authentication: 'SUCCESS',
        provider: 'Gmail SMTP',
        details: `Connected & authenticated as ${gmailUser} via smtp.gmail.com:465`,
      };
    } catch (err: any) {
      console.warn('[Email Transporter] Gmail SMTP verification note:', err.message);
      const isAuthErr = err.message?.toLowerCase().includes('auth') || err.message?.toLowerCase().includes('credential');
      return {
        connection: isAuthErr ? 'SUCCESS' : 'FAILED',
        authentication: 'FAILED',
        provider: 'Gmail SMTP',
        details: err.message,
      };
    }
  }

  const smtpHost = (process.env.SMTP_HOST || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  if (smtpHost && smtpPass) {
    try {
      const port = Number(process.env.SMTP_PORT) || 465;
      const secure = port === 465 || process.env.SMTP_SECURE === 'true';
      const user = (process.env.SMTP_USER || '').trim();
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: { user, pass: smtpPass },
      });
      await transporter.verify();
      console.log('[Email Transporter] SMTP connection: SUCCESS');
      console.log('[Email Transporter] SMTP authentication: SUCCESS');
      return {
        connection: 'SUCCESS',
        authentication: 'SUCCESS',
        provider: 'Custom SMTP',
        details: `Connected & authenticated as ${user} via ${smtpHost}:${port}`,
      };
    } catch (err: any) {
      console.warn('[Email Transporter] Custom SMTP verification note:', err.message);
      return {
        connection: 'FAILED',
        authentication: 'FAILED',
        provider: 'Custom SMTP',
        details: err.message,
      };
    }
  }

  return {
    connection: 'FAILED',
    authentication: 'FAILED',
    provider: 'None',
    details: 'No SMTP service configured in environment variables.',
  };
}

/**
 * Resolves the admin notification email address.
 * Priority order:
 * 1. SiteSettings adminNotificationEmail (customizable from Admin Portal)
 * 2. ADMIN_NOTIFICATION_EMAIL environment variable
 * 3. ADMIN_EMAIL environment variable
 * 4. Default: oforir74444@gmail.com
 */
export function getAdminNotificationRecipient(settings?: SiteSettings): string {
  const currentSettings = settings || getSettings();
  if (currentSettings.adminNotificationEmail && currentSettings.adminNotificationEmail.trim()) {
    return currentSettings.adminNotificationEmail.trim();
  }
  if (process.env.ADMIN_NOTIFICATION_EMAIL && process.env.ADMIN_NOTIFICATION_EMAIL.trim()) {
    return process.env.ADMIN_NOTIFICATION_EMAIL.trim();
  }
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.trim()) {
    return process.env.ADMIN_EMAIL.trim();
  }
  return 'oforir74444@gmail.com';
}

/**
 * Builds HTML template for the admin instant purchase notification.
 * SECURITY: NEVER contains passwords, backup codes, or secret tokens.
 */
export function generateAdminPurchaseEmailHtml(order: Order, recipientEmail: string, settings: SiteSettings): string {
  const storeName = settings.storeName || 'PlayVault Ghana';
  const logoText = settings.logoText || storeName;
  const formattedGHS = `GH₵ ${order.amountGHS.toFixed(2)}`;
  const formattedUSD = `$${order.priceUSD.toFixed(2)}`;
  const formattedDate = order.paidAt ? new Date(order.paidAt).toLocaleString('en-GB', { timeZone: 'Africa/Accra' }) : new Date().toLocaleString();

  const discountRow = order.discountStatus === 'APPLIED' && order.discountUSD ? `
    <tr>
      <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">First-Purchase Discount</td>
      <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #10b981; font-weight: 600; font-size: 13px; text-align: right;">-$${order.discountUSD.toFixed(2)} USD (Applied)</td>
    </tr>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Paid Order: ${order.orderNumber}</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; line-height: 1.5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
    
    <!-- Header Banner -->
    <div style="background: linear-gradient(135deg, #1e3a8a 0%, #090d16 100%); padding: 28px 24px; border-bottom: 1px solid #1e293b;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #38bdf8; font-weight: 700; margin-bottom: 6px;">
        ${logoText} • Store Admin Alert
      </div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
        🎉 New Successful Purchase!
      </h1>
      <p style="margin: 6px 0 0; font-size: 14px; color: #94a3b8;">
        Paystack payment verified. Order is now <strong style="color: #f59e0b;">AWAITING FULFILLMENT</strong>.
      </p>
    </div>

    <!-- Main Content -->
    <div style="padding: 24px;">
      
      <!-- Key Metric Highlight Card -->
      <div style="background-color: #1e293b; border-radius: 12px; padding: 18px; margin-bottom: 24px; border-left: 4px solid #10b981;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td>
              <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Amount Received</div>
              <div style="font-size: 24px; font-weight: 800; color: #10b981; font-family: monospace;">${formattedGHS}</div>
            </td>
            <td style="text-align: right;">
              <div style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Order Number</div>
              <div style="font-size: 15px; font-weight: 700; color: #ffffff; font-family: monospace;">${order.orderNumber}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Order Summary Table -->
      <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin: 0 0 12px; font-weight: 700;">
        Order & Game Details
      </h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #0b1120; border-radius: 10px; overflow: hidden; border: 1px solid #1e293b;">
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">Game Title</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #ffffff; font-weight: 700; font-size: 13px; text-align: right;">${order.gameTitleSnapshot}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">Console Platform</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #ffffff; font-weight: 600; font-size: 13px; text-align: right;">
            <span style="background-color: #2563eb; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">${order.console}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">Account Slot Type</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #ffffff; font-size: 13px; text-align: right;">${order.accountTypeSnapshot}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">Catalog Price (USD)</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #ffffff; font-size: 13px; text-align: right;">${formattedUSD}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">Store Exchange Rate</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #ffffff; font-size: 13px; text-align: right;">1 USD = GH₵ ${order.exchangeRate.toFixed(2)}</td>
        </tr>
        ${discountRow}
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">Paystack Reference</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #38bdf8; font-family: monospace; font-size: 12px; text-align: right;">${order.paystackReference}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">Payment Channel</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #ffffff; font-size: 13px; text-align: right;">${order.paymentChannel || 'Paystack Ghana (MoMo/Card)'}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #94a3b8; font-size: 13px;">Payment Timestamp</td>
          <td style="padding: 10px 16px; color: #ffffff; font-size: 13px; text-align: right;">${formattedDate}</td>
        </tr>
      </table>

      <!-- Customer Contact Table -->
      <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin: 0 0 12px; font-weight: 700;">
        Customer Information
      </h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #0b1120; border-radius: 10px; overflow: hidden; border: 1px solid #1e293b;">
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">Full Name</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #ffffff; font-weight: 600; font-size: 13px; text-align: right;">${order.customerName}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">Email Address</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #38bdf8; font-size: 13px; text-align: right;">
            <a href="mailto:${order.customerEmail}" style="color: #38bdf8; text-decoration: none;">${order.customerEmail}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">Phone / WhatsApp</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #ffffff; font-family: monospace; font-size: 13px; text-align: right;">
            <a href="https://wa.me/${order.customerPhone.replace(/[^0-9]/g, '')}" style="color: #22c55e; text-decoration: none; font-weight: 600;">
              ${order.customerPhone} (WhatsApp)
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #94a3b8; font-size: 13px;">Customer Account Type</td>
          <td style="padding: 10px 16px; color: #ffffff; font-size: 13px; text-align: right;">${order.customerType === 'GOOGLE' ? 'Verified Google Customer' : 'Direct Customer'}</td>
        </tr>
      </table>

      <!-- Next Action Callout -->
      <div style="background-color: #0b1120; border: 1px dashed #3b82f6; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <div style="font-weight: 700; color: #60a5fa; font-size: 13px; margin-bottom: 4px;">
          ⚡ Admin Action Required
        </div>
        <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
          Please log in to your ${storeName} Admin Portal to allocate or fulfill the account credentials for order <strong>${order.orderNumber}</strong>. Once fulfilled, setup instructions are instantly viewable in the customer's portal.
        </p>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #090d16; padding: 16px 24px; border-top: 1px solid #1e293b; text-align: center; font-size: 11px; color: #64748b;">
      <div>This automated notification was delivered to <strong>${recipientEmail}</strong> upon verified Paystack payment.</div>
      <div style="margin-top: 4px;">${storeName} • PlayStation Digital Storefront Ghana</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Builds plain text version of admin purchase email.
 */
export function generateAdminPurchaseEmailText(order: Order, recipientEmail: string, settings: SiteSettings): string {
  const storeName = settings.storeName || 'PlayVault Ghana';
  return `
[${storeName} ADMIN NOTIFICATION] NEW SUCCESSFUL PURCHASE

Paystack has successfully verified payment for order ${order.orderNumber}.
Status: AWAITING FULFILLMENT

ORDER DETAILS:
----------------------------------------
- Order Number: ${order.orderNumber}
- Game: ${order.gameTitleSnapshot}
- Console: ${order.console}
- Account Slot: ${order.accountTypeSnapshot}
- Price USD: $${order.priceUSD.toFixed(2)}
- Amount Received: GH₵ ${order.amountGHS.toFixed(2)}
- Exchange Rate: 1 USD = GH₵ ${order.exchangeRate.toFixed(2)}
- Paystack Ref: ${order.paystackReference}
- Payment Channel: ${order.paymentChannel || 'Paystack Ghana'}
- Paid At: ${order.paidAt || new Date().toISOString()}

CUSTOMER DETAILS:
----------------------------------------
- Name: ${order.customerName}
- Email: ${order.customerEmail}
- Phone / WhatsApp: ${order.customerPhone}
- Account: ${order.customerType === 'GOOGLE' ? 'Verified Google User' : 'Direct'}

NEXT STEP:
Log in to the ${storeName} Admin Portal to assign PSN account credentials and fulfill the order.
Recipient: ${recipientEmail}
  `.trim();
}

/**
 * Builds HTML template for the real Customer Delivery email.
 * Delivered to the customer's email on the order upon admin fulfillment.
 */
export function generateCustomerDeliveryEmailHtml(
  order: Order,
  deliveryInfo: DeliveryInformation,
  settings: SiteSettings
): string {
  const storeName = settings.storeName || 'PlayVault Ghana';
  const logoText = settings.logoText || storeName;
  const whatsappNum = settings.supportWhatsApp || '+233 24 123 4567';
  const cleanWhatsApp = whatsappNum.replace(/[^0-9]/g, '');
  const supportEmail = settings.supportEmail || 'support@playvault.com';

  const backupCodesSection = deliveryInfo.backupCodes && deliveryInfo.backupCodes.trim() ? `
    <div style="margin-top: 20px;">
      <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #f59e0b; margin: 0 0 8px; font-weight: 700;">
        🔑 Backup 2FA Codes
      </h3>
      <div style="background-color: #0b1120; border: 1px solid #334155; border-radius: 8px; padding: 12px 16px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 14px; font-weight: bold; color: #fbbf24; word-break: break-all;">
        ${escapeHtml(deliveryInfo.backupCodes)}
      </div>
      <p style="margin: 4px 0 0; font-size: 11px; color: #94a3b8;">
        Use one of these one-time codes if prompted for 2-step verification during sign-in.
      </p>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🎮 Your ${storeName} Order Is Ready — #${order.orderNumber}</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #020617; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
    
    <!-- Header Banner -->
    <div style="background: linear-gradient(135deg, #1e40af 0%, #0f172a 100%); padding: 32px 24px; border-bottom: 1px solid #1e293b; text-align: center;">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #60a5fa; font-weight: 700; margin-bottom: 8px;">
        ${logoText} • PlayStation Digital Delivery
      </div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
        🎮 Your Order Is Ready!
      </h1>
      <p style="margin: 8px 0 0; font-size: 14px; color: #cbd5e1;">
        Hello <strong>${escapeHtml(order.customerName)}</strong>, your PlayStation account details are ready below.
      </p>
    </div>

    <!-- Body -->
    <div style="padding: 24px;">

      <!-- ORDER DETAILS SECTION -->
      <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; margin: 0 0 10px; font-weight: 700;">
        Order Details
      </h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background-color: #0b1120; border-radius: 10px; overflow: hidden; border: 1px solid #1e293b;">
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">Order Number</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #38bdf8; font-weight: 700; font-family: monospace; font-size: 14px; text-align: right;">#${order.orderNumber}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">Game</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #ffffff; font-weight: 700; font-size: 13px; text-align: right;">${escapeHtml(order.gameTitleSnapshot)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">Console</td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #1e293b; color: #ffffff; font-weight: 600; font-size: 13px; text-align: right;">
            <span style="background-color: #2563eb; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700;">${order.console}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 10px 16px; color: #94a3b8; font-size: 13px;">Account Slot Type</td>
          <td style="padding: 10px 16px; color: #ffffff; font-size: 13px; text-align: right;">${escapeHtml(order.accountTypeSnapshot)}</td>
        </tr>
      </table>

      <!-- YOUR ACCOUNT CREDENTIALS HIGHLIGHT -->
      <div style="background-color: #1e293b; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #334155; border-left: 4px solid #3b82f6;">
        <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #60a5fa; margin: 0 0 14px; font-weight: 800;">
          🎮 Your PSN Account Credentials
        </h2>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #94a3b8; font-size: 13px; vertical-align: top; width: 140px;">PSN Email / Username:</td>
            <td style="padding: 8px 0; font-size: 14px; font-weight: 700; font-family: monospace; color: #38bdf8; word-break: break-all;">
              ${escapeHtml(deliveryInfo.accountEmail)}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #94a3b8; font-size: 13px; vertical-align: top;">Password:</td>
            <td style="padding: 8px 0; font-size: 15px; font-weight: 800; font-family: monospace; color: #ffffff; word-break: break-all;">
              ${escapeHtml(deliveryInfo.accountPassword)}
            </td>
          </tr>
        </table>

        ${backupCodesSection}
      </div>

      <!-- SETUP INSTRUCTIONS -->
      <div style="background-color: #0b1120; border: 1px solid #1e293b; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
        <h3 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #38bdf8; margin: 0 0 10px; font-weight: 700;">
          📋 Setup Instructions
        </h3>
        <div style="font-size: 13px; color: #e2e8f0; white-space: pre-wrap; line-height: 1.6; font-family: inherit;">
${escapeHtml(deliveryInfo.setupInstructions)}
        </div>
      </div>

      <!-- SECURITY & IMPORTANT NOTICE -->
      <div style="background-color: #172554; border: 1px solid #1d4ed8; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <div style="font-weight: 800; color: #93c5fd; font-size: 13px; margin-bottom: 6px;">
          ⚠️ Important Security Notice
        </div>
        <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #bfdbfe; line-height: 1.6;">
          <li>Please keep these account details private and do not share them with anyone.</li>
          <li>Do not change the PSN account email or password unless specified in your account tier rules.</li>
          <li>Access your purchase at any time via your <strong>My Games</strong> customer account or order tracking page.</li>
        </ul>
      </div>

      <!-- WHATSAPP & SUPPORT ASSISTANCE -->
      <div style="background-color: #064e3b; border: 1px solid #059669; border-radius: 12px; padding: 16px; text-align: center;">
        <div style="font-size: 13px; font-weight: 700; color: #6ee7b7; margin-bottom: 4px;">
          💬 Need help setting up on your console?
        </div>
        <p style="margin: 0 0 12px; font-size: 12px; color: #a7f3d0;">
          Our support team is available on WhatsApp. Expected response time: <strong>Within 30 minutes</strong>.
        </p>
        <a href="https://wa.me/${cleanWhatsApp}?text=Hello%20${encodeURIComponent(storeName)}%2C%20I%20need%20help%20with%20my%20order%20%23${order.orderNumber}"
           style="display: inline-block; background-color: #10b981; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; padding: 10px 20px; border-radius: 8px;">
          Chat with Support on WhatsApp (${whatsappNum})
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #090d16; padding: 20px 24px; border-top: 1px solid #1e293b; text-align: center; font-size: 11px; color: #64748b;">
      <div style="font-weight: 600; color: #94a3b8;">${storeName} • PlayStation Digital Game Store Ghana</div>
      <div style="margin-top: 4px;">Thank you for your purchase! Support Email: ${supportEmail}</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Builds plain text version of customer delivery email.
 */
export function generateCustomerDeliveryEmailText(
  order: Order,
  deliveryInfo: DeliveryInformation,
  settings: SiteSettings
): string {
  const storeName = settings.storeName || 'PlayVault Ghana';
  const whatsappNum = settings.supportWhatsApp || '+233 24 123 4567';

  let backupText = '';
  if (deliveryInfo.backupCodes && deliveryInfo.backupCodes.trim()) {
    backupText = `
--------------------------------
BACKUP 2FA CODES
${deliveryInfo.backupCodes}
`;
  }

  return `
Hello ${order.customerName},

Your ${storeName} order is ready! 🎮

Your PlayStation account details are below.

--------------------------------
ORDER DETAILS

Order Number:
#${order.orderNumber}

Game:
${order.gameTitleSnapshot}

Console:
${order.console}

Account Type:
${order.accountTypeSnapshot}

--------------------------------
YOUR ACCOUNT

PSN Email / Username:
${deliveryInfo.accountEmail}

Password:
${deliveryInfo.accountPassword}

--------------------------------
SETUP INSTRUCTIONS

${deliveryInfo.setupInstructions}
${backupText}
--------------------------------
IMPORTANT

Please keep these account details private and do not share them with anyone.

If you have any problems setting up the account, contact ${storeName} support through WhatsApp:
${whatsappNum}

Expected support response:
Within 30 minutes.

Thank you for your purchase!

${storeName}
PlayStation Digital Game Store
  `.trim();
}

export interface EmailConfigStatus {
  isConfigured: boolean;
  activeProvider: 'Gmail SMTP' | 'Resend' | 'SendGrid' | 'Custom SMTP' | 'None';
  senderAddress: string;
  recipientAddress: string;
  details: string;
}

/**
 * Returns the active email delivery provider and configuration status.
 */
export function getEmailConfigStatus(): EmailConfigStatus {
  const settings = getSettings();
  const recipientAddress = getAdminNotificationRecipient(settings);

  // 1. Gmail SMTP via Google App Password
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || '').trim();
  if (gmailPass && !gmailPass.includes('xxxx')) {
    const gmailUser = (process.env.GMAIL_USER || 'oforir74444@gmail.com').trim();
    return {
      isConfigured: true,
      activeProvider: 'Gmail SMTP',
      senderAddress: gmailUser,
      recipientAddress,
      details: `Active via Gmail SMTP (${gmailUser}) using Google App Password.`,
    };
  }

  // 2. Resend API
  const resendApiKey = (process.env.RESEND_API_KEY || process.env.EMAIL_PROVIDER_API_KEY || '').trim();
  if (resendApiKey && resendApiKey.startsWith('re_') && !resendApiKey.includes('test_xxx')) {
    const sender = process.env.EMAIL_FROM || 'onboarding@resend.dev';
    return {
      isConfigured: true,
      activeProvider: 'Resend',
      senderAddress: sender,
      recipientAddress,
      details: `Active via Resend API (Sender: ${sender}).`,
    };
  }

  // 3. SendGrid API
  const sendgridApiKey = (process.env.SENDGRID_API_KEY || '').trim();
  if (sendgridApiKey && sendgridApiKey.startsWith('SG.')) {
    const sender = process.env.EMAIL_FROM || 'orders@playvault.com';
    return {
      isConfigured: true,
      activeProvider: 'SendGrid',
      senderAddress: sender,
      recipientAddress,
      details: `Active via SendGrid API (Sender: ${sender}).`,
    };
  }

  // 4. Custom SMTP
  const smtpHost = (process.env.SMTP_HOST || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  if (smtpHost && smtpPass) {
    const sender = process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER || 'smtp@playvault.com';
    return {
      isConfigured: true,
      activeProvider: 'Custom SMTP',
      senderAddress: sender,
      recipientAddress,
      details: `Active via Custom SMTP server (${smtpHost}).`,
    };
  }

  return {
    isConfigured: false,
    activeProvider: 'None',
    senderAddress: 'None configured',
    recipientAddress,
    details: 'No email service credentials found in server environment variables.',
  };
}

/**
 * Unified server-side email dispatcher supporting Gmail SMTP, Custom SMTP, Resend, and SendGrid.
 * SECURITY: Never logs passwords, customer credentials, or email body contents.
 */
async function dispatchEmailMessage(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  settings: SiteSettings;
  orderNumber?: string;
  flowType?: 'CUSTOMER_DELIVERY' | 'ADMIN_NOTIFICATION';
}): Promise<EmailSendResult> {
  const { to, subject, html, text, settings, orderNumber, flowType } = params;
  const storeName = settings.storeName || 'PlayVault Ghana';
  const supportEmail = settings.supportEmail?.trim();

  // 1. Gmail SMTP via Nodemailer
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS || '').trim().replace(/\s+/g, '');
  if (gmailPass && !gmailPass.includes('xxxx')) {
    const gmailUser = (process.env.GMAIL_USER || 'oforir74444@gmail.com').trim();
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: gmailUser,
          pass: gmailPass,
        },
      });

      const replyToAddress = supportEmail || gmailUser;
      const info = await transporter.sendMail({
        from: `"${storeName}" <${gmailUser}>`,
        to,
        replyTo: replyToAddress,
        subject,
        html,
        text,
      });

      const acceptedList = Array.isArray(info.accepted) ? info.accepted.map(String) : [];
      const rejectedList = Array.isArray(info.rejected) ? info.rejected.map(String) : [];

      // Safe delivery diagnostics logging (Item 8 format: NO credentials or secrets)
      console.log('----------------------------------------');
      console.log('EMAIL DELIVERY RESULT');
      console.log('Order:');
      console.log(orderNumber || 'N/A');
      console.log('Flow:');
      console.log(flowType || 'CUSTOMER_DELIVERY');
      console.log('Recipient:');
      console.log(to);
      console.log('Provider:');
      console.log('Gmail SMTP');
      console.log('Accepted:');
      console.log(acceptedList.length > 0 ? acceptedList.join(', ') : 'none');
      console.log('Rejected:');
      console.log(rejectedList.length > 0 ? rejectedList.join(', ') : 'none');
      console.log('Message ID:');
      console.log(info.messageId || 'none');
      console.log('Provider Response:');
      console.log(info.response || 'none');
      console.log('----------------------------------------');

      const isAccepted = acceptedList.length > 0 && !rejectedList.some((r) => r.toLowerCase() === to.toLowerCase());

      if (!isAccepted) {
        console.warn(`[Email Dispatch] Gmail SMTP did not accept recipient (${to}). Rejected list:`, rejectedList);
        return {
          success: false,
          provider: 'Gmail SMTP',
          accepted: acceptedList,
          rejected: rejectedList,
          response: info.response,
          error: `Gmail SMTP server rejected recipient address (${to}): ${info.response || 'Rejected by mail server'}`,
        };
      }

      return {
        success: true,
        provider: 'Gmail SMTP',
        messageId: info.messageId,
        accepted: acceptedList,
        rejected: rejectedList,
        response: info.response,
      };
    } catch (err: any) {
      console.error('[Email Dispatch] Gmail SMTP error:', err.message);
      return {
        success: false,
        provider: 'Gmail SMTP',
        error: `Gmail delivery failed: ${err.message || 'Authentication error with Google App Password.'}`,
      };
    }
  }

  // 2. Custom SMTP via Nodemailer
  const smtpHost = (process.env.SMTP_HOST || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  if (smtpHost && smtpPass) {
    try {
      const port = Number(process.env.SMTP_PORT) || 465;
      const secure = port === 465 || process.env.SMTP_SECURE === 'true';
      const user = (process.env.SMTP_USER || '').trim();
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        auth: {
          user,
          pass: smtpPass,
        },
      });

      const fromAddress = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"${storeName}" <${user}>`;
      const replyToAddress = supportEmail || user;
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        replyTo: replyToAddress,
        subject,
        html,
        text,
      });

      const acceptedList = Array.isArray(info.accepted) ? info.accepted.map(String) : [];
      const rejectedList = Array.isArray(info.rejected) ? info.rejected.map(String) : [];

      console.log('----------------------------------------');
      console.log('EMAIL DELIVERY RESULT');
      console.log('Order:');
      console.log(orderNumber || 'N/A');
      console.log('Flow:');
      console.log(flowType || 'CUSTOMER_DELIVERY');
      console.log('Recipient:');
      console.log(to);
      console.log('Provider:');
      console.log('Custom SMTP');
      console.log('Accepted:');
      console.log(acceptedList.length > 0 ? acceptedList.join(', ') : 'none');
      console.log('Rejected:');
      console.log(rejectedList.length > 0 ? rejectedList.join(', ') : 'none');
      console.log('Message ID:');
      console.log(info.messageId || 'none');
      console.log('Provider Response:');
      console.log(info.response || 'none');
      console.log('----------------------------------------');

      const isAccepted = acceptedList.length > 0 && !rejectedList.some((r) => r.toLowerCase() === to.toLowerCase());

      if (!isAccepted) {
        return {
          success: false,
          provider: 'Custom SMTP',
          accepted: acceptedList,
          rejected: rejectedList,
          response: info.response,
          error: `SMTP server rejected recipient address (${to}): ${info.response || 'Rejected by mail server'}`,
        };
      }

      return {
        success: true,
        provider: 'Custom SMTP',
        messageId: info.messageId,
        accepted: acceptedList,
        rejected: rejectedList,
        response: info.response,
      };
    } catch (err: any) {
      console.error('[Email Dispatch] Custom SMTP error:', err.message);
      return {
        success: false,
        provider: 'Custom SMTP',
        error: `SMTP delivery failed: ${err.message}`,
      };
    }
  }

  // 3. Resend HTTP API
  const resendApiKey = (process.env.RESEND_API_KEY || process.env.EMAIL_PROVIDER_API_KEY || '').trim();
  if (resendApiKey && resendApiKey.startsWith('re_') && !resendApiKey.includes('test_xxx')) {
    try {
      let emailFrom = (process.env.EMAIL_FROM || '').trim();
      if (!emailFrom) {
        // Resend free tier unverified domain fallback
        emailFrom = `${storeName} <onboarding@resend.dev>`;
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [to],
          reply_to: supportEmail || undefined,
          subject,
          html,
          text,
        }),
      });

      const data = await response.json();

      console.log('----------------------------------------');
      console.log('EMAIL DELIVERY RESULT');
      console.log('Order:');
      console.log(orderNumber || 'N/A');
      console.log('Flow:');
      console.log(flowType || 'CUSTOMER_DELIVERY');
      console.log('Recipient:');
      console.log(to);
      console.log('Provider:');
      console.log('Resend');
      console.log('Accepted:');
      console.log(response.ok ? to : 'none');
      console.log('Rejected:');
      console.log(response.ok ? 'none' : to);
      console.log('Message ID:');
      console.log(data?.id || 'none');
      console.log('Provider Response:');
      console.log(response.status + ' ' + (data?.message || 'OK'));
      console.log('----------------------------------------');

      if (response.ok && data.id) {
        return {
          success: true,
          provider: 'Resend',
          messageId: data.id,
          accepted: [to],
          rejected: [],
        };
      } else {
        const errorMsg = data?.message || data?.error || 'Resend rejected delivery';
        console.error('[Email Dispatch] Resend API error:', errorMsg);
        return {
          success: false,
          provider: 'Resend',
          accepted: [],
          rejected: [to],
          error: `Resend error: ${errorMsg}`,
        };
      }
    } catch (err: any) {
      console.error('[Email Dispatch] Resend network error:', err.message);
      return {
        success: false,
        provider: 'Resend',
        error: `Network error reaching Resend: ${err.message}`,
      };
    }
  }

  // 4. SendGrid HTTP API
  const sendgridApiKey = (process.env.SENDGRID_API_KEY || '').trim();
  if (sendgridApiKey && sendgridApiKey.startsWith('SG.')) {
    try {
      const emailFrom = process.env.EMAIL_FROM || `${storeName} <orders@playvault.com>`;
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: emailFrom.includes('<') ? emailFrom.replace(/.*<([^>]+)>.*/, '$1') : emailFrom },
          reply_to: supportEmail ? { email: supportEmail } : undefined,
          subject,
          content: [
            { type: 'text/plain', value: text },
            { type: 'text/html', value: html },
          ],
        }),
      });

      console.log('----------------------------------------');
      console.log('EMAIL DELIVERY RESULT');
      console.log('Order:');
      console.log(orderNumber || 'N/A');
      console.log('Flow:');
      console.log(flowType || 'CUSTOMER_DELIVERY');
      console.log('Recipient:');
      console.log(to);
      console.log('Provider:');
      console.log('SendGrid');
      console.log('Accepted:');
      console.log(response.ok || response.status === 202 ? to : 'none');
      console.log('Rejected:');
      console.log(response.ok || response.status === 202 ? 'none' : to);
      console.log('Message ID:');
      console.log(response.headers?.get('x-message-id') || 'sendgrid_queued');
      console.log('Provider Response:');
      console.log(response.status + ' ' + response.statusText);
      console.log('----------------------------------------');

      if (response.ok || response.status === 202) {
        return {
          success: true,
          provider: 'SendGrid',
          accepted: [to],
          rejected: [],
        };
      } else {
        const errorText = await response.text();
        console.error('[Email Dispatch] SendGrid error:', errorText);
        return {
          success: false,
          provider: 'SendGrid',
          accepted: [],
          rejected: [to],
          error: `SendGrid error: ${errorText}`,
        };
      }
    } catch (err: any) {
      console.error('[Email Dispatch] SendGrid network error:', err.message);
      return {
        success: false,
        provider: 'SendGrid',
        error: `Network error reaching SendGrid: ${err.message}`,
      };
    }
  }

  // 5. No Email Provider Configured
  return {
    success: false,
    provider: 'None',
    error: 'No email service is configured. Please add GMAIL_APP_PASSWORD, RESEND_API_KEY, or SMTP_HOST in Settings (Environment Variables) to enable real email delivery.',
  };
}

/**
 * Sends customer delivery email with PlayStation credentials.
 * SECURITY: Never logs credentials or full bodies to stdout or error messages.
 */
export async function sendCustomerDeliveryEmail(
  order: Order,
  deliveryInfo: DeliveryInformation
): Promise<EmailSendResult> {
  const settings = getSettings();
  const recipient = order.customerEmail.trim();

  if (!recipient || !recipient.includes('@')) {
    return {
      success: false,
      error: `Invalid customer email address (${order.customerEmail}) on order #${order.orderNumber}`,
    };
  }

  const subject = `🎮 Your ${settings.storeName || 'PlayVault'} Order Is Ready — #${order.orderNumber}`;
  const html = generateCustomerDeliveryEmailHtml(order, deliveryInfo, settings);
  const text = generateCustomerDeliveryEmailText(order, deliveryInfo, settings);

  return dispatchEmailMessage({
    to: recipient,
    subject,
    html,
    text,
    settings,
    orderNumber: order.orderNumber,
    flowType: 'CUSTOMER_DELIVERY',
  });
}

/**
 * Sends the instant purchase email notification to the administrator.
 */
export async function sendAdminPurchaseNotification(order: Order): Promise<EmailSendResult> {
  const settings = getSettings();

  if (settings.adminNotificationEmailEnabled === false) {
    return { success: true, simulation: true };
  }

  const recipientEmail = getAdminNotificationRecipient(settings);
  const subject = `[New Paid Order] ${order.orderNumber} - ${order.gameTitleSnapshot} (GH₵ ${order.amountGHS.toFixed(2)})`;
  const html = generateAdminPurchaseEmailHtml(order, recipientEmail, settings);
  const text = generateAdminPurchaseEmailText(order, recipientEmail, settings);

  return dispatchEmailMessage({
    to: recipientEmail,
    subject,
    html,
    text,
    settings,
    orderNumber: order.orderNumber,
    flowType: 'ADMIN_NOTIFICATION',
  });
}

function escapeHtml(text?: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
