import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { Order } from './src/types';
import {
  getSettings,
  updateSettings,
  getGames,
  getGameById,
  createGame,
  updateGame,
  deleteGame,
  archiveGame,
  restoreGame,
  getAccountTypes,
  createAccountType,
  updateAccountType,
  deleteAccountType,
  getOrders,
  getOrderById,
  getOrderByReference,
  createOrder,
  markOrderPaid,
  updateOrderStatus,
  fulfillOrder,
  updateOrderDeliveryEmailStatus,
  getFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  getAuditLogs,
  addAuditLog,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getAnalytics,
  getInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  checkUserFirstPurchaseEligibility,
  getOrdersForCustomer,
  getCustomerOrderById,
  processVerifiedPaystackPayment,
  reserveAccountForOrder,
  finalizeOrderFulfillment,
  handleFulfillmentEmailFailure,
  checkAccountAssignmentEligibility,
  releaseOrderAccount,
} from './server/db';
import { verifyFirebaseIdToken } from './server/auth';
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
  isRealPaystackKeyConfigured,
  getPaystackGatewayStatus,
} from './server/paystack';
import {
  isCloudinaryConfigured,
  uploadGameCoverToCloudinary,
  deleteCloudinaryAsset,
} from './server/cloudinary';
import { isValidYouTubeUrl } from './src/lib/youtube';
import {
  sendAdminPurchaseNotification,
  getAdminNotificationRecipient,
  sendCustomerDeliveryEmail,
  getEmailConfigStatus,
  verifyEmailTransporter,
} from './server/email';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable trust proxy for accurate host and proto detection behind reverse proxies
  app.set('trust proxy', true);

  // Use JSON middleware with raw body retention for webhook verification and 15mb limit for image uploads
  app.use(
    express.json({
      limit: '15mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));
  app.use(cookieParser());

  // Static directory for uploaded images (covers, media)
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // ----------------- Admin Authentication Security -----------------
  const ADMIN_COOKIE_NAME = 'reygames_admin_session';
  const ADMIN_SECRET = process.env.ADMIN_SESSION_SECRET || 'reygames-admin-secret-session-key';
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@reygames.com';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  // In-memory token revocation set
  const revokedAdminTokens = new Set<string>();

  // IP-based failed login rate limiter (max 5 failed attempts per 15 minutes)
  interface RateLimitEntry {
    failures: number;
    blockedUntil?: number;
  }
  const loginRateLimits = new Map<string, RateLimitEntry>();

  function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || 'unknown';
  }

  function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
    const entry = loginRateLimits.get(ip);
    if (!entry) return { allowed: true };
    if (entry.blockedUntil) {
      const diff = entry.blockedUntil - Date.now();
      if (diff > 0) {
        return { allowed: false, retryAfterSeconds: Math.ceil(diff / 1000) };
      } else {
        loginRateLimits.delete(ip);
        return { allowed: true };
      }
    }
    return { allowed: true };
  }

  function recordLoginFailure(ip: string): void {
    const entry = loginRateLimits.get(ip) || { failures: 0 };
    entry.failures += 1;
    if (entry.failures >= 5) {
      entry.blockedUntil = Date.now() + 15 * 60 * 1000; // 15-minute lock
    }
    loginRateLimits.set(ip, entry);
  }

  function recordLoginSuccess(ip: string): void {
    loginRateLimits.delete(ip);
  }

  function generateAdminToken(emailOrUser: string): string {
    const timestamp = Date.now();
    const payload = `${emailOrUser}:${timestamp}`;
    const signature = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex');
    return Buffer.from(`${payload}:${signature}`).toString('base64');
  }

  function verifyAdminToken(token?: string): { valid: boolean; user?: string } {
    if (!token || typeof token !== 'string') return { valid: false };
    const trimmed = token.trim();

    // Check if token has been revoked on logout
    if (revokedAdminTokens.has(trimmed)) {
      return { valid: false };
    }

    // 1. Direct admin passcode check
    const validPasscodes = [ADMIN_PASSWORD];
    if (validPasscodes.includes(trimmed)) {
      return { valid: true, user: 'Store Administrator' };
    }

    // 2. Base64 HMAC token check (email:timestamp:signature)
    try {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
      const parts = decoded.split(':');
      if (parts.length >= 3) {
        const emailOrUser = parts[0];
        const timestampStr = parts[1];
        const signature = parts[2];
        const expectedSig = crypto.createHmac('sha256', ADMIN_SECRET).update(`${emailOrUser}:${timestampStr}`).digest('hex');

        if (expectedSig === signature) {
          const timestamp = parseInt(timestampStr, 10);
          if (!isNaN(timestamp) && Date.now() - timestamp <= 24 * 60 * 60 * 1000) {
            return { valid: true, user: emailOrUser };
          }
        }
      }
    } catch {}

    return { valid: false };
  }

  function requireAdmin(req: Request, res: Response, next: express.NextFunction) {
    // 1. Primary: Secure HttpOnly Cookie
    let token = req.cookies ? req.cookies[ADMIN_COOKIE_NAME] : undefined;

    // 2. Fallback for programmatic API clients / Bearer authorization headers
    if (!token) {
      const authHeader = (req.headers['authorization'] ||
        req.headers['x-admin-token'] ||
        req.query.adminToken ||
        req.query.token) as string;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
      } else if (typeof authHeader === 'string') {
        token = authHeader.trim();
      }
    }

    const { valid, user } = verifyAdminToken(token as string);
    if (!valid) {
      return res.status(401).json({ error: 'Unauthorized: Valid administrator authentication session required' });
    }

    // 3. CSRF Protection for state-changing methods (POST, PUT, PATCH, DELETE)
    const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
    if (isMutating && req.cookies && req.cookies[ADMIN_COOKIE_NAME]) {
      const origin = req.headers['origin'] || req.headers['referer'];
      const host = req.headers['host'];
      const csrfHeader = req.headers['x-admin-csrf'] || req.headers['x-requested-with'];

      let originMatches = true;
      if (origin && typeof origin === 'string' && host && typeof host === 'string') {
        try {
          const originHost = new URL(origin).host;
          originMatches = originHost === host;
        } catch {
          originMatches = false;
        }
      }

      if (!csrfHeader && !originMatches) {
        return res.status(403).json({ error: 'Forbidden: CSRF validation failed. Missing anti-tamper header or invalid origin.' });
      }
    }

    (req as any).adminUser = user || 'Admin';
    (req as any).adminToken = token;
    next();
  }

  // ----------------- API Endpoints -----------------

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      store: getSettings().storeName,
      time: new Date().toISOString(),
      paystackLiveConfigured: isRealPaystackKeyConfigured(),
    });
  });

  // Dedicated Admin Session Validation Endpoint
  app.get('/api/admin/session', requireAdmin, (req: Request, res: Response) => {
    res.json({
      authenticated: true,
      adminUser: (req as any).adminUser,
    });
  });

  // Dedicated Admin Logout Endpoint (Server-side Token Invalidation & Cookie Removal)
  app.post('/api/admin/logout', (req: Request, res: Response) => {
    let token = req.cookies ? req.cookies[ADMIN_COOKIE_NAME] : undefined;
    if (!token) {
      const authHeader = (req.headers['authorization'] || req.headers['x-admin-token']) as string;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
      } else if (typeof authHeader === 'string') {
        token = authHeader.trim();
      }
    }

    if (token) {
      revokedAdminTokens.add(token.trim());
    }

    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    res.clearCookie(ADMIN_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: isHttps,
      sameSite: isHttps ? 'none' : 'lax',
    });

    res.json({ success: true, message: 'Administrator session invalidated and cookie cleared.' });
  });

  // Admin Login (Exchanges administrator credentials for secure HttpOnly cookie)
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const rateLimit = checkLoginRateLimit(ip);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: `Too many failed login attempts. Please wait ${rateLimit.retryAfterSeconds} seconds before trying again.`,
      });
    }

    const { email, password, passcode } = req.body;
    const validPasscodes = [ADMIN_PASSWORD];

    // Standard credential validation (Email + Password, or Master Passcode)
    let isAuthorized = false;
    let adminIdentity = 'Store Administrator';

    if (passcode && typeof passcode === 'string') {
      const cleanPass = passcode.trim();
      if (validPasscodes.includes(cleanPass)) {
        isAuthorized = true;
        adminIdentity = 'Store Administrator';
      }
    }

    if (email && typeof email === 'string' && password && typeof password === 'string') {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();
      const isEmailValid = cleanEmail === ADMIN_EMAIL.toLowerCase();
      const isPasswordValid = cleanPassword === ADMIN_PASSWORD;

      if (isEmailValid && isPasswordValid) {
        isAuthorized = true;
        adminIdentity = cleanEmail;
      }
    }

    if (isAuthorized) {
      recordLoginSuccess(ip);
      const token = generateAdminToken(adminIdentity);

      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
      const cookieOptions: express.CookieOptions = {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? 'none' : 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      };

      res.cookie(ADMIN_COOKIE_NAME, token, cookieOptions);

      // Return ONLY safe administrator identity — do NOT expose raw token to frontend JavaScript!
      return res.json({
        success: true,
        adminUser: adminIdentity,
        message: 'Administrator authenticated successfully.',
      });
    }

    recordLoginFailure(ip);
    return res.status(401).json({ error: 'Invalid email or password.' });
  });

  // Public & Admin Settings
  app.get('/api/settings', (_req: Request, res: Response) => {
    const settings = getSettings();
    const publicSettings = {
      ...settings,
      paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || process.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_sample',
      isPaystackLive: isRealPaystackKeyConfigured(),
    };
    res.json(publicSettings);
  });

  app.post(['/api/settings', '/api/admin/settings'], requireAdmin, (req: Request, res: Response) => {
    const { settings } = req.body;
    const adminUser = (req as any).adminUser || 'Admin';
    if (!settings) {
      return res.status(400).json({ error: 'Settings object required' });
    }

    // Security & Validation: Enforce legitimate YouTube video URLs for tutorials
    if (settings.ps5TutorialUrl && settings.ps5TutorialUrl.trim() && !isValidYouTubeUrl(settings.ps5TutorialUrl)) {
      return res.status(400).json({
        error: 'Invalid PS5 Tutorial URL. Please provide a valid YouTube link (e.g. https://youtu.be/VIDEO_ID or https://www.youtube.com/watch?v=VIDEO_ID)',
      });
    }
    if (settings.ps4TutorialUrl && settings.ps4TutorialUrl.trim() && !isValidYouTubeUrl(settings.ps4TutorialUrl)) {
      return res.status(400).json({
        error: 'Invalid PS4 Tutorial URL. Please provide a valid YouTube link (e.g. https://youtu.be/VIDEO_ID or https://www.youtube.com/watch?v=VIDEO_ID)',
      });
    }

    const updated = updateSettings(settings, adminUser);
    res.json({ success: true, settings: updated });
  });

  // Currency & Exchange Rate endpoint
  const handleCurrencyUpdate = (req: Request, res: Response) => {
    const { exchangeRateUSDToGHS, rate } = req.body;
    const adminUser = (req as any).adminUser || 'Admin';
    const parsedRate = parseFloat(exchangeRateUSDToGHS ?? rate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      return res.status(400).json({ error: 'Valid positive exchange rate number is required.' });
    }
    const updated = updateSettings({ exchangeRateUSDToGHS: parsedRate }, adminUser);
    res.json({ success: true, settings: updated, exchangeRateUSDToGHS: parsedRate });
  };
  app.put(['/api/settings/currency', '/api/admin/currency', '/api/admin/settings/currency'], requireAdmin, handleCurrencyUpdate);
  app.post(['/api/settings/currency', '/api/admin/currency', '/api/admin/settings/currency'], requireAdmin, handleCurrencyUpdate);

  // Admin Instant Email Notification Status & Test Trigger (Protected)
  app.get('/api/admin/notifications/email-config', requireAdmin, (_req: Request, res: Response) => {
    const settings = getSettings();
    const status = getEmailConfigStatus();
    res.json({
      ...status,
      enabled: settings.adminNotificationEmailEnabled !== false,
      configuredProvider: status.activeProvider,
      hasProductionKey: status.isConfigured,
    });
  });

  // Admin Live Email Diagnostics (Verifies SMTP connection & auth safely)
  app.get('/api/admin/notifications/email-diagnostics', requireAdmin, async (_req: Request, res: Response) => {
    try {
      const configStatus = getEmailConfigStatus();
      const verification = await verifyEmailTransporter();
      res.json({
        configStatus,
        verification,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Diagnostic verification failed' });
    }
  });

  app.post('/api/admin/notifications/test-email', requireAdmin, async (req: Request, res: Response) => {
    try {
      const settings = getSettings();
      const targetRecipient = (req.body?.recipient && typeof req.body.recipient === 'string' && req.body.recipient.includes('@'))
        ? req.body.recipient.trim()
        : getAdminNotificationRecipient(settings);
      const status = getEmailConfigStatus();

      if (!status.isConfigured) {
        return res.status(400).json({
          success: false,
          recipient: targetRecipient,
          error: 'Email delivery is not configured. Please set GMAIL_APP_PASSWORD, RESEND_API_KEY, or SMTP_HOST in Settings (Environment Variables).',
          details: status.details,
          provider: 'None',
        });
      }

      const sampleOrder: any = {
        id: 'test_order_' + Date.now(),
        orderNumber: 'TEST-' + Math.floor(100000 + Math.random() * 900000),
        gameId: 'test-game',
        gameTitleSnapshot: 'Grand Theft Auto V',
        console: 'PS5',
        accountTypeId: 'primary-shared',
        accountTypeSnapshot: 'Primary — Shared',
        customerName: 'Diagnostic Recipient Test',
        customerEmail: targetRecipient,
        customerPhone: '+233 24 123 4567',
        priceUSD: 14.00,
        exchangeRate: settings.exchangeRateUSDToGHS || 15.50,
        amountGHS: (14.00 * (settings.exchangeRateUSDToGHS || 15.50)),
        currency: 'GHS',
        paystackReference: 'test_ref_' + Date.now(),
        paymentStatus: 'PAID',
        orderStatus: 'AWAITING_FULFILLMENT',
        paymentChannel: 'Paystack Ghana (Test Notification)',
        paidAt: new Date().toISOString(),
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        customerType: 'GOOGLE',
      };

      const result = await sendAdminPurchaseNotification(sampleOrder);

      if (!result.success) {
        return res.status(502).json({
          success: false,
          recipient: targetRecipient,
          error: result.error || 'Failed to dispatch test notification.',
          provider: result.provider,
        });
      }

      res.json({
        success: true,
        recipient: targetRecipient,
        result,
        message: `Real test email successfully dispatched to ${targetRecipient} via ${result.provider}! Message ID: ${result.messageId || 'sent'}`,
      });
    } catch (err: any) {
      console.error('[Test Email] Unexpected error:', err);
      res.status(500).json({ success: false, error: err.message || 'Internal server error while sending test email.' });
    }
  });

  // Cover Image File Upload using Cloudinary (Admin Protected)
  app.post('/api/admin/upload-cover', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { imageBase64, fileName, gameId } = req.body;
      const adminUser = (req as any).adminUser || 'Admin';

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'Image data is required in base64 format.' });
      }

      if (!isCloudinaryConfigured()) {
        return res.status(400).json({
          error:
            'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server environment variables.',
        });
      }

      // Upload directly to Cloudinary using signed server-side upload
      const uploadResult = await uploadGameCoverToCloudinary(imageBase64, {
        gameId,
        fileName,
      });

      // Two-Phase Save: If an existing gameId was supplied, update the game document immediately
      let oldCloudinaryPublicId: string | undefined;
      if (gameId) {
        const existingGame = getGameById(gameId);
        oldCloudinaryPublicId = existingGame?.cloudinaryPublicId;

        const updatedGame = updateGame(
          gameId,
          {
            coverImage: uploadResult.secureUrl,
            coverImageUrl: uploadResult.secureUrl,
            cloudinaryPublicId: uploadResult.publicId,
          },
          adminUser
        );

        if (!updatedGame) {
          // Rollback newly uploaded asset if game update failed
          await deleteCloudinaryAsset(uploadResult.publicId);
          return res.status(404).json({
            error: 'Cover uploaded to Cloudinary, but target game record was not found to update.',
          });
        }

        // Old Image Cleanup: only after Firestore & database are safely updated
        if (oldCloudinaryPublicId && oldCloudinaryPublicId !== uploadResult.publicId) {
          await deleteCloudinaryAsset(oldCloudinaryPublicId);
        }
      }

      addAuditLog(
        adminUser,
        'CLOUDINARY_COVER_UPLOAD',
        `Uploaded game cover to Cloudinary for ${gameId || 'new game'} (${uploadResult.publicId})`
      );

      res.json({
        success: true,
        url: uploadResult.secureUrl,
        secureUrl: uploadResult.secureUrl,
        publicId: uploadResult.publicId,
        fileName: uploadResult.publicId,
        size: uploadResult.bytes,
      });
    } catch (err: any) {
      console.error('[Cloudinary API] Cover upload error:', err.message || err);
      res.status(500).json({
        error: err.message || 'Failed to upload cover image to Cloudinary.',
      });
    }
  });

  // Cloudinary Asset Deletion (Admin Protected)
  app.delete('/api/admin/cloudinary-asset', requireAdmin, async (req: Request, res: Response) => {
    try {
      const publicId = (req.query.publicId || req.body.publicId) as string;
      if (!publicId) {
        return res.status(400).json({ error: 'Cloudinary publicId is required' });
      }
      const success = await deleteCloudinaryAsset(publicId);
      res.json({ success });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete asset from Cloudinary' });
    }
  });

  // Games Catalog
  app.get('/api/games', (req: Request, res: Response) => {
    let includeInactive = false;
    if (req.query.admin === 'true') {
      const authHeader = (req.headers['authorization'] || req.headers['x-admin-token'] || req.query.adminToken) as string;
      let token = authHeader;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
      }
      const { valid } = verifyAdminToken(token);
      if (valid) {
        includeInactive = true;
      }
    }
    const games = getGames(includeInactive);
    res.json(games);
  });

  app.get('/api/games/:id', (req: Request, res: Response) => {
    const game = getGameById(req.params.id);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json(game);
  });

  app.post(['/api/games', '/api/admin/games'], requireAdmin, (req: Request, res: Response) => {
    const { game } = req.body;
    const adminUser = (req as any).adminUser || 'Admin';
    if (!game || !game.title) {
      return res.status(400).json({ error: 'Game title and details are required' });
    }
    const normalizedGame = {
      ...game,
      coverImage: game.coverImageUrl || game.coverImage || '',
      coverImageUrl: game.coverImageUrl || game.coverImage || '',
    };
    const created = createGame(normalizedGame, adminUser);
    res.json({ success: true, game: created });
  });

  app.put(['/api/games/:id', '/api/admin/games/:id'], requireAdmin, (req: Request, res: Response) => {
    const { game } = req.body;
    const adminUser = (req as any).adminUser || 'Admin';
    const normalizedGame = {
      ...game,
      coverImage: game.coverImageUrl || game.coverImage,
      coverImageUrl: game.coverImageUrl || game.coverImage,
    };
    const updated = updateGame(req.params.id, normalizedGame, adminUser);
    if (!updated) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json({ success: true, game: updated });
  });

  // Archive Game (Admin Protected)
  app.put(['/api/games/:id/archive', '/api/admin/games/:id/archive'], requireAdmin, (req: Request, res: Response) => {
    const adminUser = (req as any).adminUser || 'Admin';
    const result = archiveGame(req.params.id, adminUser);
    if (!result.success) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json({
      success: true,
      isArchived: true,
      hasOrders: result.hasOrders,
      game: result.game,
      message: `Game successfully archived. Customer orders preserved.`,
    });
  });

  // Restore Game to Catalog (Admin Protected)
  app.put(['/api/games/:id/restore', '/api/admin/games/:id/restore'], requireAdmin, (req: Request, res: Response) => {
    const adminUser = (req as any).adminUser || 'Admin';
    const result = restoreGame(req.params.id, adminUser);
    if (!result.success) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json({
      success: true,
      isArchived: false,
      isActive: true,
      game: result.game,
      message: `Game successfully restored to public storefront catalog.`,
    });
  });

  app.delete(['/api/games/:id', '/api/admin/games/:id'], requireAdmin, async (req: Request, res: Response) => {
    const adminUser = (req as any).adminUser || 'Admin';
    const forcePermanent = req.query.permanent === 'true';
    const existingGame = getGameById(req.params.id);
    if (!existingGame) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const result = deleteGame(req.params.id, adminUser, forcePermanent);
    if (!result.success) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // IMPORTANT (Requirement 20): DO NOT delete Cloudinary asset if game is archived!
    // Only permanently delete Cloudinary asset if forcePermanent is true, it had zero orders, and is not archived.
    if (!result.isArchived && forcePermanent && existingGame.cloudinaryPublicId) {
      await deleteCloudinaryAsset(existingGame.cloudinaryPublicId);
    }

    res.json({
      success: true,
      isArchived: result.isArchived,
      hasOrders: result.hasOrders,
      message: result.isArchived
        ? `Game "${existingGame.title}" safely archived. Customer order history preserved.`
        : `Game "${existingGame.title}" permanently removed.`,
    });
  });

  // Account Types
  app.get('/api/account-types', (_req: Request, res: Response) => {
    res.json(getAccountTypes());
  });

  app.post(['/api/account-types', '/api/admin/account-types'], requireAdmin, (req: Request, res: Response) => {
    const { accountType } = req.body;
    const adminUser = (req as any).adminUser || 'Admin';
    if (!accountType || !accountType.name) {
      return res.status(400).json({ error: 'Account type name is required.' });
    }
    const created = createAccountType(accountType, adminUser);
    res.json({ success: true, accountType: created });
  });

  app.put(['/api/account-types/:id', '/api/admin/account-types/:id'], requireAdmin, (req: Request, res: Response) => {
    const { updates } = req.body;
    const adminUser = (req as any).adminUser || 'Admin';
    const updated = updateAccountType(req.params.id, updates, adminUser);
    if (!updated) {
      return res.status(404).json({ error: 'Account type not found' });
    }
    res.json({ success: true, accountType: updated });
  });

  app.delete(['/api/account-types/:id', '/api/admin/account-types/:id'], requireAdmin, (req: Request, res: Response) => {
    const adminUser = (req as any).adminUser || 'Admin';
    const ok = deleteAccountType(req.params.id, adminUser);
    if (!ok) {
      return res.status(404).json({ error: 'Account type not found' });
    }
    res.json({ success: true });
  });

  // Promotion: Check Google First-Purchase Discount Eligibility
  app.post('/api/promotions/check-eligibility', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      const idToken = req.body?.idToken || tokenFromHeader;

      const currentSettings = getSettings();
      const promotionEnabled = currentSettings.firstPurchaseDiscountEnabled !== false;
      const discountAmount = currentSettings.firstPurchaseDiscountAmountUSD ?? 1.00;

      if (!promotionEnabled) {
        return res.json({
          eligible: false,
          discountUSD: 0,
          promotionEnabled: false,
          reason: 'disabled',
        });
      }

      if (!idToken) {
        return res.json({
          eligible: false,
          discountUSD: 0,
          promotionEnabled: true,
          reason: 'not_authenticated',
        });
      }

      const verifiedUser = await verifyFirebaseIdToken(idToken);
      if (!verifiedUser) {
        return res.json({
          eligible: false,
          discountUSD: 0,
          promotionEnabled: true,
          reason: 'not_authenticated',
        });
      }

      const eligibility = checkUserFirstPurchaseEligibility(verifiedUser.uid, verifiedUser.email);
      return res.json({
        eligible: eligibility.eligible,
        discountUSD: eligibility.eligible ? discountAmount : 0,
        promotionEnabled,
        reason: eligibility.reason,
        user: {
          uid: verifiedUser.uid,
          email: verifiedUser.email,
          displayName: verifiedUser.displayName,
          photoURL: verifiedUser.photoURL,
        },
      });
    } catch (err: any) {
      console.error('[Promotion] Error checking eligibility:', err.message);
      return res.status(500).json({ error: 'Failed to verify promotion eligibility' });
    }
  });

  // Orders: Creation (Customer)
  app.post('/api/orders/create', async (req: Request, res: Response) => {
    const {
      gameId,
      console: consoleType,
      accountTypeId,
      customerName,
      customerEmail,
      customerPhone,
      termsAccepted,
      isGoogleAccount,
      idToken,
    } = req.body;

    if (!gameId || !consoleType || !accountTypeId || !customerName || !customerEmail || !customerPhone) {
      return res.status(400).json({ error: 'All fields (Game, Console, Account Type, Name, Email, Phone) are required' });
    }

    if (!termsAccepted) {
      return res.status(400).json({ error: 'You must accept the Terms & Conditions before continuing' });
    }

    const game = getGameById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const accountTypes = getAccountTypes();
    const accountType = accountTypes.find(a => a.id === accountTypeId);
    if (!accountType) {
      return res.status(404).json({ error: 'Invalid account type selected' });
    }

    // Determine catalog USD price directly from database
    const originalPriceUSD =
      game.accountPrices[accountTypeId as keyof typeof game.accountPrices] ?? accountType.defaultPriceUSD;
    const settings = getSettings();
    const exchangeRate = settings.exchangeRateUSDToGHS;

    let discountUSD = 0;
    let customerType: 'GOOGLE' | 'GUEST' = 'GUEST';
    let customerGoogleUid: string | undefined = undefined;
    let discountType: 'FIRST_GAME_PURCHASE' | 'NONE' = 'NONE';
    let discountStatus: 'APPLIED' | 'NONE' = 'NONE';
    let discountEligibility = 'GUEST';

    // Verify Google account server-side if user chose Google checkout or provided token
    const authHeader = req.headers.authorization;
    const token = idToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (isGoogleAccount && token) {
      const verifiedUser = await verifyFirebaseIdToken(token);
      if (verifiedUser) {
        customerType = 'GOOGLE';
        customerGoogleUid = verifiedUser.uid;
        const eligibility = checkUserFirstPurchaseEligibility(verifiedUser.uid, verifiedUser.email);
        if (eligibility.eligible) {
          const promoAmount = settings.firstPurchaseDiscountAmountUSD ?? 1.00;
          discountUSD = Math.min(originalPriceUSD, promoAmount);
          discountType = 'FIRST_GAME_PURCHASE';
          discountStatus = 'APPLIED';
          discountEligibility = 'ELIGIBLE';
        } else {
          discountEligibility = eligibility.reason || 'ALREADY_USED';
        }
      } else {
        customerType = 'GUEST';
        discountEligibility = 'TOKEN_INVALID';
      }
    }

    // Final price calculation (Server Authoritative)
    const finalPriceUSD = Math.max(0, originalPriceUSD - discountUSD);
    const amountGHS = Math.round(finalPriceUSD * exchangeRate * 100) / 100;

    const secureToken = crypto.randomBytes(16).toString('hex');
    const paystackReference = `PSG_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const newOrder = createOrder({
      secureToken,
      userId: customerGoogleUid || undefined,
      customerGoogleUid,
      customerName,
      customerEmail,
      customerPhone,
      gameId: game.id,
      gameTitleSnapshot: game.title,
      gameCoverSnapshot: game.coverImage,
      console: consoleType,
      accountTypeId,
      accountTypeSnapshot: accountType.name,
      priceUSD: finalPriceUSD, // keeps compatibility
      originalPriceUSD,
      discountUSD,
      finalPriceUSD,
      customerType,
      isGoogleAccount: customerType === 'GOOGLE',
      discountType,
      discountStatus,
      discountEligibility,
      discountUsed: false,
      exchangeRate,
      amountGHS,
      currency: 'GHS',
      paystackReference,
      paymentStatus: 'PENDING_PAYMENT',
      orderStatus: 'PENDING_PAYMENT',
      termsAccepted: true,
      termsAcceptedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      order: newOrder,
      originalPriceUSD,
      discountUSD,
      finalPriceUSD,
      exchangeRate,
      amountGHS,
    });
  });

  // ---------------- Customer Accounts & Private My Games ----------------

  // Customer: Private "My Games" Purchase History
  // Strictly authenticated via verified Firebase ID Token. Extracts authenticated UID server-side.
  app.get('/api/customer/my-games', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required to access My Games.' });
    }

    const verifiedUser = await verifyFirebaseIdToken(token);
    if (!verifiedUser) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired customer session token.' });
    }

    const customerOrders = getOrdersForCustomer(verifiedUser.uid);
    res.json({
      success: true,
      user: {
        uid: verifiedUser.uid,
        email: verifiedUser.email,
        displayName: verifiedUser.displayName,
        photoURL: verifiedUser.photoURL,
      },
      orders: customerOrders,
    });
  });

  // Customer: Individual Order Details
  // Strictly verifies authenticated customer UID matches order owner (userId or customerGoogleUid).
  app.get('/api/customer/orders/:orderId', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required to view order.' });
    }

    const verifiedUser = await verifyFirebaseIdToken(token);
    if (!verifiedUser) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired customer session token.' });
    }

    const result = getCustomerOrderById(req.params.orderId, verifiedUser.uid);
    if (result === 'FORBIDDEN') {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view this order.' });
    }
    if (!result) {
      return res.status(404).json({ error: 'Order not found. Please verify your order number.' });
    }

    res.json({
      success: true,
      order: result,
    });
  });

  // Orders: Customer Order View (Protected by cryptographic token, customer email/phone, or verified admin token)
  app.get('/api/orders/:id', async (req: Request, res: Response) => {
    const { token, email, phone } = req.query;
    const authHeader = (req.headers['authorization'] || req.headers['x-admin-token']) as string;
    let tokenStr = authHeader;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      tokenStr = authHeader.slice(7).trim();
    }
    const adminCheck = verifyAdminToken(tokenStr);

    let order = getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found. Please verify your order number.' });
    }

    // Auto-reconciliation check: If pending with a Paystack reference and older than 10s, attempt safe check
    if (order.paymentStatus === 'PENDING_PAYMENT' && order.paystackReference) {
      const orderAge = Date.now() - new Date(order.createdAt).getTime();
      if (orderAge > 10000) {
        try {
          const recResult = await processVerifiedPaystackPayment(order.paystackReference, { source: 'auto_reconciliation' });
          if (recResult.success && recResult.order) {
            order = recResult.order;
          }
        } catch {}
      }
    }

    // Verified Admin access allows full viewing
    if (adminCheck.valid) {
      return res.json(order);
    }

    // Customer session isolation check: If a customer token is provided, verify ownership
    let authenticatedUserUid: string | null = null;
    if (tokenStr && !adminCheck.valid) {
      const verifiedUser = await verifyFirebaseIdToken(tokenStr);
      if (verifiedUser) {
        authenticatedUserUid = verifiedUser.uid;
      }
    }

    const orderOwnerUid = order.userId || order.customerGoogleUid;

    // Cross-customer security defense:
    // If Customer B is signed in and requests Customer A's order, REJECT with 403 Forbidden!
    if (authenticatedUserUid && orderOwnerUid && authenticatedUserUid !== orderOwnerUid) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view this order.' });
    }

    // If order was placed by the currently authenticated customer, authorize automatically!
    const isOwnerByAuth = Boolean(authenticatedUserUid && orderOwnerUid && authenticatedUserUid === orderOwnerUid);

    const tokenMatches = Boolean(token && typeof token === 'string' && order.secureToken === token.trim());
    const emailMatches = Boolean(
      email &&
      typeof email === 'string' &&
      order.customerEmail.toLowerCase().trim() === email.toLowerCase().trim()
    );
    const phoneMatches = Boolean(
      phone &&
      typeof phone === 'string' &&
      order.customerPhone.replace(/\D/g, '') === phone.replace(/\D/g, '')
    );
    const isAuthorized = isOwnerByAuth || tokenMatches || emailMatches || phoneMatches;

    // LAYER 2 SECURITY: If order is not fulfilled yet, sensitive credentials are NEVER transmitted over the wire
    if (order.orderStatus !== 'FULFILLED') {
      const sanitizedOrder = { ...order };
      delete sanitizedOrder.deliveryInformation;
      if (!isAuthorized) {
        // Keep secureToken private if not authenticated
        delete (sanitizedOrder as any).secureToken;
      }
      return res.json(sanitizedOrder);
    }

    // Customer viewing fulfilled order: If not authorized by token/email/phone/auth, lock credentials
    if (!isAuthorized) {
      const sanitizedOrder = { ...order };
      delete sanitizedOrder.deliveryInformation;
      delete (sanitizedOrder as any).secureToken;
      return res.json({
        ...sanitizedOrder,
        credentialsLocked: true,
      });
    }

    // Customer viewing fulfilled order with valid auth: delivery info is provided, BUT admin-only internal notes must NEVER be exposed
    const customerOrder = { ...order };
    if (customerOrder.deliveryInformation) {
      const { notes, ...safeDeliveryInfo } = customerOrder.deliveryInformation;
      customerOrder.deliveryInformation = safeDeliveryInfo;
    }

    return res.json(customerOrder);
  });

  // Orders: Admin List (Protected)
  app.get('/api/admin/orders', requireAdmin, (req: Request, res: Response) => {
    const status = req.query.status as string;
    const orders = getOrders(status);
    res.json(orders);
  });

  // Orders: Admin Status Update (Protected)
  app.post('/api/admin/orders/:id/status', requireAdmin, (req: Request, res: Response) => {
    const { status } = req.body;
    const adminUser = (req as any).adminUser || 'Admin';
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    try {
      const updated = updateOrderStatus(req.params.id, status, adminUser);
      if (!updated) {
        return res.status(404).json({ error: 'Order not found' });
      }
      res.json({ success: true, order: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  const inFlightFulfillments = new Set<string>();

  // Orders: Admin Fulfillment (Strict Sequence: Validate & Reserve -> Dispatch Email -> Finalize)
  app.post('/api/admin/orders/:id/fulfill', requireAdmin, async (req: Request, res: Response) => {
    const orderId = req.params.id;
    const { deliveryInformation, allowWithoutEmail, allowOverride } = req.body;
    const adminUser = (req as any).adminUser || (req as any).adminEmail || 'Admin';

    // 0. Double-click concurrency lock (Idempotency)
    if (inFlightFulfillments.has(orderId)) {
      return res.status(429).json({ error: 'Fulfillment is already in progress for this order. Please wait.' });
    }
    inFlightFulfillments.add(orderId);

    try {
      console.log(`[Fulfillment] FULFILL_REQUEST_RECEIVED for order ${orderId} by admin "${adminUser}" (Override: ${Boolean(allowOverride)})`);

      // 1. Authenticate admin: verified by requireAdmin middleware
      console.log(`[Fulfillment] ADMIN_AUTH_VALID for admin "${adminUser}"`);

      // 2. Load order from database
      const order = getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // 3. Verify payment is PAID
      if (order.paymentStatus !== 'PAID') {
        return res.status(400).json({ error: `Cannot fulfill order ${order.orderNumber}: Payment status is ${order.paymentStatus}` });
      }
      console.log(`[Fulfillment] PAYMENT_VALID: Order ${order.orderNumber} is PAID`);

      // Idempotency: If already fulfilled and customer email was already sent
      if (order.orderStatus === 'FULFILLED' && order.deliveryEmailStatus === 'SENT') {
        return res.json({
          success: true,
          order,
          message: 'Order was already fulfilled and delivery email already sent to customer.',
        });
      }

      // 4. Verify order is eligible for fulfillment
      if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'REFUNDED') {
        return res.status(400).json({ error: `Cannot fulfill order ${order.orderNumber}: Order is ${order.orderStatus}` });
      }
      console.log(`[Fulfillment] ORDER_VALID: Order ${order.orderNumber} eligible for fulfillment (${order.orderStatus})`);

      // 5. Validate PSN credentials
      if (!deliveryInformation || !deliveryInformation.accountEmail?.trim() || !deliveryInformation.accountPassword?.trim()) {
        return res.status(400).json({ error: 'Account email/username and password are required for fulfillment' });
      }

      const safeDeliveryInfo = {
        accountEmail: deliveryInformation.accountEmail.trim(),
        accountPassword: deliveryInformation.accountPassword.trim(),
        setupInstructions: deliveryInformation.setupInstructions?.trim() || 'Please refer to your account instructions.',
        backupCodes: deliveryInformation.backupCodes?.trim() || '',
        notes: deliveryInformation.notes?.trim() || '',
        fulfilledAt: new Date().toISOString(),
        fulfilledBy: adminUser,
      };

      // 6, 7 & 8. RESOLVE INVENTORY, CHECK ELIGIBILITY & ATOMICALLY RESERVE ASSIGNMENT
      // CRITICAL: MUST EXECUTE AND PASS BEFORE ANY EMAIL DISPATCH!
      let reservationResult: { order: Order; inventoryItem: any };
      try {
        reservationResult = reserveAccountForOrder(order.id, safeDeliveryInfo, adminUser, Boolean(allowOverride));
        console.log(`[Fulfillment] INVENTORY_VALID & ASSIGNMENT_RESERVED for account ${safeDeliveryInfo.accountEmail}`);
      } catch (validationErr: any) {
        console.warn(`[Fulfillment] Validation/Reservation FAILED for order ${order.orderNumber}: ${validationErr.message}`);
        // ABSOLUTE RULE: DO NOT SEND EMAIL!
        const errorMsg = validationErr.message || 'Validation/Reservation failed';
        const isConflict = errorMsg.includes('Conflict');
        return res.status(409).json({
          error: errorMsg,
          isConflict,
          canOverride: isConflict,
        });
      }

      // If administrator explicitly requested bypass without dispatching email
      if (allowWithoutEmail) {
        const updated = finalizeOrderFulfillment(order.id, safeDeliveryInfo, adminUser, {
          status: 'FAILED',
          provider: 'manual_bypass',
          error: 'Fulfilled without email upon administrator request',
        });
        return res.json({
          success: true,
          order: updated,
          emailSent: false,
          warning: 'Order fulfilled! Credentials saved to customer account, but delivery email was bypassed.',
          deliveryEmailStatus: 'FAILED',
        });
      }

      // 9. ONLY AFTER STEPS 1-8 PASS: DISPATCH CUSTOMER DELIVERY EMAIL
      console.log(`[Fulfillment] EMAIL_SEND_STARTED for order ${order.orderNumber} to ${order.customerEmail}`);
      const emailResult = await sendCustomerDeliveryEmail(reservationResult.order, safeDeliveryInfo);

      if (emailResult.success) {
        console.log(`[Fulfillment] EMAIL_SEND_SUCCESS via ${emailResult.provider}`);
        // 10. Email succeeded! Mark order = FULFILLED and assignment = DELIVERED
        const updated = finalizeOrderFulfillment(order.id, safeDeliveryInfo, adminUser, {
          status: 'ACCEPTED',
          provider: emailResult.provider,
          messageId: emailResult.messageId,
          sentAt: new Date().toISOString(),
        });
        console.log(`[Fulfillment] ORDER_FULFILLED: Order ${order.orderNumber} is now FULFILLED`);

        return res.json({
          success: true,
          order: updated,
          emailResult: {
            success: true,
            provider: emailResult.provider,
            messageId: emailResult.messageId,
            accepted: emailResult.accepted,
            rejected: emailResult.rejected,
            simulation: emailResult.simulation,
          },
          message: `Order fulfilled! Credentials email accepted for delivery to ${order.customerEmail}. (Advise customer to check Inbox & Spam/Junk)`,
        });
      } else {
        console.warn(`[Fulfillment] Email dispatch failed: ${emailResult.error}. Preserving reservation.`);
        // Email failure: Preserve inventory assignment, mark deliveryEmailStatus = FAILED, orderStatus = DELIVERY_FAILED
        const updated = handleFulfillmentEmailFailure(order.id, emailResult, adminUser);

        return res.status(502).json({
          success: false,
          order: updated,
          error: `Customer email could not be sent: ${emailResult.error || 'Email service unavailable.'}`,
          details: 'The PSN account has been reserved and assigned to this order. Credentials are saved in the customer account, and you can click [Resend Delivery Email] anytime once email settings are configured.',
          deliveryEmailStatus: 'FAILED',
          allowBypass: true,
        });
      }
    } catch (err: any) {
      console.error(`[Fulfillment] Unexpected error during fulfillment for order ${orderId}:`, err);
      return res.status(500).json({ error: err.message || 'Internal server error during fulfillment' });
    } finally {
      inFlightFulfillments.delete(orderId);
    }
  });

  // Orders: Admin Resend Delivery Email (Protected & Idempotent)
  app.post('/api/admin/orders/:id/resend-delivery-email', requireAdmin, async (req: Request, res: Response) => {
    const adminUser = (req as any).adminUser || (req as any).adminEmail || 'Admin';
    const order = getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!order.deliveryInformation || !order.deliveryInformation.accountEmail || !order.deliveryInformation.accountPassword) {
      return res.status(400).json({ error: 'Order does not have delivery credentials attached yet.' });
    }

    try {
      console.log(`[Fulfillment] RESEND_EMAIL_STARTED for order ${order.orderNumber} to ${order.customerEmail}`);
      const emailResult = await sendCustomerDeliveryEmail(order, order.deliveryInformation);

      if (!emailResult.success) {
        console.warn(`[Fulfillment] RESEND_EMAIL_FAILED for order ${order.orderNumber}: ${emailResult.error}`);
        handleFulfillmentEmailFailure(order.id, emailResult, adminUser);

        return res.status(502).json({
          success: false,
          error: `Customer email could not be sent: ${emailResult.error || 'Email service unavailable.'}`,
          deliveryEmailStatus: 'FAILED',
        });
      }

      console.log(`[Fulfillment] RESEND_EMAIL_SUCCESS for order ${order.orderNumber}`);
      const updated = finalizeOrderFulfillment(order.id, order.deliveryInformation, adminUser, {
        status: 'ACCEPTED',
        provider: emailResult.provider,
        messageId: emailResult.messageId,
        sentAt: new Date().toISOString(),
      });

      return res.json({
        success: true,
        order: updated,
        emailResult: {
          success: true,
          provider: emailResult.provider,
          messageId: emailResult.messageId,
          accepted: emailResult.accepted,
          rejected: emailResult.rejected,
        },
        message: `Delivery email accepted for delivery to ${order.customerEmail}. (Advise customer to check Inbox & Spam/Junk)`,
      });
    } catch (err: any) {
      console.error(`[Fulfillment] Error resending delivery email for order ${order.orderNumber}:`, err);
      return res.status(500).json({ error: err.message || 'Internal server error resending email' });
    }
  });

  // Orders: Admin Manual Payment Reconciliation with Paystack (Protected)
  app.post('/api/admin/orders/:id/reconcile-paystack', requireAdmin, async (req: Request, res: Response) => {
    const adminUser = (req as any).adminEmail || (req as any).adminUser || 'Admin';
    const order = getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    if (!order.paystackReference) {
      return res.status(400).json({ success: false, error: 'Order does not have a Paystack reference.' });
    }

    console.log(`[Admin Reconciliation] Admin "${adminUser}" initiated Paystack verification for order ${order.orderNumber} (Ref: ${order.paystackReference})`);

    try {
      const result = await processVerifiedPaystackPayment(order.paystackReference, {
        source: 'admin_reconciliation',
        adminUser,
      });

      if (result.success && result.order) {
        return res.json({
          success: true,
          status: result.status,
          message: result.message || `Payment verified with Paystack! Order ${order.orderNumber} is now PAID and AWAITING FULFILLMENT.`,
          order: result.order,
        });
      }

      return res.status(400).json({
        success: false,
        status: result.status,
        error: result.error || 'Payment could not be verified by Paystack.',
        order: result.order || order,
        raw: result.raw,
      });
    } catch (err: any) {
      console.error('[Admin Reconciliation] Error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Server error reconciling payment with Paystack.' });
    }
  });

  // Check PSN account assignment eligibility for an order (Protected)
  app.get('/api/admin/orders/:id/check-assignment-eligibility', requireAdmin, (req: Request, res: Response) => {
    const order = getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    const accountEmail = req.query.accountEmail as string;
    if (!accountEmail) {
      return res.status(400).json({ error: 'accountEmail query parameter is required' });
    }
    const eligibility = checkAccountAssignmentEligibility(accountEmail, order);
    res.json(eligibility);
  });

  // Orders: Admin Release Assigned PSN Account from Order (Protected)
  app.post('/api/admin/orders/:id/release-account', requireAdmin, (req: Request, res: Response) => {
    const adminUser = (req as any).adminUser || (req as any).adminEmail || 'Admin';
    try {
      const updated = releaseOrderAccount(req.params.id, adminUser);
      res.json({
        success: true,
        order: updated,
        message: `PSN account successfully released from order ${updated.orderNumber}.`,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ----------------- Paystack Endpoints -----------------

  // Public Gateway Status (Non-sensitive: provider, currency, mode, configured status)
  app.get('/api/payment/status', (_req: Request, res: Response) => {
    res.json(getPaystackGatewayStatus());
  });

  // Admin Payment Status (Protected)
  app.get('/api/admin/payment-status', requireAdmin, (_req: Request, res: Response) => {
    res.json(getPaystackGatewayStatus());
  });

  // Helper to determine reliable public HTTPS base URL for Paystack redirect callbacks
  function getPublicAppBaseUrl(req?: Request, clientOrigin?: string): string {
    // 1. Client-supplied origin (from browser window.location.origin during checkout)
    if (clientOrigin && typeof clientOrigin === 'string') {
      const cleanOrigin = clientOrigin.trim().replace(/\/+$/, '');
      if (cleanOrigin.startsWith('https://') && !cleanOrigin.includes('localhost') && !cleanOrigin.includes('127.0.0.1')) {
        return cleanOrigin;
      }
    }

    // 2. Explicitly configured public URL environment variable (PUBLIC_APP_URL, APP_BASE_URL, APP_URL)
    const envUrl = process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || process.env.APP_URL;
    if (envUrl && typeof envUrl === 'string') {
      const cleanEnv = envUrl.trim().replace(/\/+$/, '');
      if (cleanEnv.startsWith('http') && !cleanEnv.includes('localhost') && !cleanEnv.includes('127.0.0.1')) {
        return cleanEnv;
      }
    }

    // 3. Incoming request headers (reverse proxy / Cloud Run)
    if (req) {
      const reqOrigin = req.get('origin');
      if (reqOrigin && reqOrigin.startsWith('https://') && !reqOrigin.includes('localhost')) {
        return reqOrigin.trim().replace(/\/+$/, '');
      }

      const referer = req.get('referer');
      if (referer && referer.startsWith('https://') && !referer.includes('localhost')) {
        try {
          const u = new URL(referer);
          return `${u.protocol}//${u.host}`;
        } catch {}
      }

      const forwardedProto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim();
      const forwardedHost = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim();
      if (forwardedHost && !forwardedHost.includes('localhost') && !forwardedHost.includes('127.0.0.1')) {
        const proto = forwardedProto || 'https';
        return `${proto}://${forwardedHost}`;
      }

      const host = req.get('host');
      if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        const proto = forwardedProto || 'https';
        return `${proto}://${host}`;
      }
    }

    // 4. Default fallback: production Cloud Run container URL
    return (process.env.APP_URL || 'https://ais-dev-xfgo6dqv25ntac7qnujfjk-15435631469.europe-west2.run.app').trim().replace(/\/+$/, '');
  }

  // Paystack: Initialize Payment (Uses permanently locked order amount)
  app.post('/api/paystack/initialize', async (req: Request, res: Response) => {
    const { orderId, secureToken, clientOrigin } = req.body;
    if (!orderId || !secureToken) {
      return res.status(400).json({ success: false, error: 'Order ID and secure token are required.' });
    }

    const order = getOrderById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    if (order.secureToken !== secureToken) {
      return res.status(403).json({ success: false, error: 'Invalid order authorization token.' });
    }

    if (order.paymentStatus === 'PAID') {
      return res.status(400).json({ success: false, error: 'Order is already marked as paid.' });
    }

    const baseUrl = getPublicAppBaseUrl(req, clientOrigin);
    const callbackUrl = `${baseUrl}/api/paystack/callback?orderId=${encodeURIComponent(order.id)}&token=${encodeURIComponent(order.secureToken)}`;
    console.log(`[Paystack Init] Order ${order.orderNumber} initialized with callback URL: ${callbackUrl}`);

    try {
      const initResult = await initializePaystackTransaction({
        email: order.customerEmail,
        amountGHS: order.amountGHS, // Locked amount from order
        reference: order.paystackReference,
        callbackUrl,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          customerPhone: order.customerPhone,
          gameTitle: order.gameTitleSnapshot,
          console: order.console,
          accountType: order.accountTypeSnapshot,
          priceUSD: order.priceUSD,
          exchangeRate: order.exchangeRate,
          amountGHS: order.amountGHS,
        },
      });

      if (!initResult.status || !initResult.data) {
        return res.status(400).json({
          success: false,
          error: initResult.message || 'Unable to start payment. Please try again.',
        });
      }

      addAuditLog(
        'Customer Checkout',
        'PAYMENT_INITIALIZED',
        `Initialized Paystack checkout for order ${order.orderNumber} (Ref: ${order.paystackReference}, Amount: GH₵ ${order.amountGHS.toFixed(2)}).`
      );

      res.json({
        success: true,
        data: initResult.data,
      });
    } catch (err: any) {
      console.error('Paystack initialization error:', err);
      res.status(500).json({ success: false, error: 'Unable to start payment. Please try again.' });
    }
  });

  // Paystack: Server-side Callback Handler (Redirects customer back to PlayVault order tracking)
  async function handlePaystackCallback(req: Request, res: Response) {
    const reference = ((req.query.reference || req.query.trxref) as string)?.trim();
    const orderId = (req.query.orderId as string)?.trim();
    const token = (req.query.token as string)?.trim();

    console.log(`[Paystack Callback] Received redirect from Paystack: reference="${reference}", orderId="${orderId}"`);

    if (!reference && !orderId) {
      console.warn('[Paystack Callback] Missing transaction reference parameter in callback URL');
      return res.redirect('/?payment=failed&reason=missing_reference');
    }

    const targetRef = reference || orderId;
    const result = await processVerifiedPaystackPayment(targetRef, { source: 'callback' });

    if (result.success && result.order) {
      console.log(`[Paystack Callback] Order ${result.order.orderNumber} confirmed PAID. Redirecting customer to order tracking.`);
      return res.redirect(`/?order=${encodeURIComponent(result.order.id)}&token=${encodeURIComponent(result.order.secureToken)}&payment=confirmed`);
    }

    const orderParam = result.order ? `&order=${encodeURIComponent(result.order.id)}&token=${encodeURIComponent(result.order.secureToken)}` : '';
    console.warn(`[Paystack Callback] Verification failed for ${targetRef}: ${result.error}`);
    return res.redirect(`/?payment=${encodeURIComponent(result.status || 'failed')}${orderParam}&reason=${encodeURIComponent(result.error || '')}`);
  }

  // Register dedicated backend callback routes
  app.get('/api/paystack/callback', handlePaystackCallback);
  app.get('/api/payments/paystack/callback', handlePaystackCallback);

  // Also intercept frontend callback paths if query includes Paystack reference
  app.get(['/payment/callback', '/checkout/payment/callback'], (req: Request, res: Response, next) => {
    const reference = (req.query.reference || req.query.trxref) as string;
    if (reference) {
      return handlePaystackCallback(req, res);
    }
    return next();
  });

  // Paystack: Server-Side Verification (Verifies Paystack response against locked order amount)
  app.get('/api/paystack/verify/:reference', async (req: Request, res: Response) => {
    const reference = req.params.reference;
    if (!reference) {
      return res.status(400).json({ success: false, error: 'Payment reference required' });
    }

    const result = await processVerifiedPaystackPayment(reference, { source: 'api' });

    if (result.success && result.order) {
      return res.json({
        success: true,
        status: 'success',
        message: result.message || 'Payment verified and order confirmed',
        order: result.order,
      });
    }

    return res.status(400).json({
      success: false,
      status: result.status,
      message: result.error || 'Payment could not be verified by Paystack',
      error: result.error,
      order: result.order,
      raw: result.raw,
    });
  });

  // Paystack: Webhook Listener (Authoritative payment confirmation)
  app.post('/api/paystack/webhook', async (req: any, res: Response) => {
    const signature = req.headers['x-paystack-signature'] as string;
    if (!signature) {
      console.warn('[Paystack Webhook] REJECTED: Missing x-paystack-signature header');
      return res.status(401).send('Missing signature');
    }

    const rawBody = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));

    if (!verifyPaystackWebhookSignature(rawBody, signature)) {
      console.warn('[Paystack Webhook] REJECTED: Invalid HMAC SHA-512 signature');
      addAuditLog(
        'Paystack Security',
        'INVALID_WEBHOOK_SIGNATURE',
        'Received Paystack webhook with invalid signature hash.'
      );
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;
    const eventType = event?.event;
    const ref = event?.data?.reference;

    console.log(`[Paystack Webhook] Event received: "${eventType}" | Ref: "${ref || 'n/a'}"`);

    if (eventType === 'charge.success') {
      if (ref) {
        const result = await processVerifiedPaystackPayment(ref, { source: 'webhook' });
        console.log(
          `[Paystack Webhook] Event: charge.success | Order: ${result.order?.orderNumber || 'unknown'} | Ref: ${ref} | VerificationResult: ${result.status} (success=${result.success}) | PaymentStatus: ${result.order?.paymentStatus || 'unknown'}`
        );
        return res.status(200).send('Webhook processed');
      } else {
        console.warn('[Paystack Webhook] Event charge.success received without transaction reference.');
      }
    } else {
      console.log(`[Paystack Webhook] Ignored non-charge event: ${eventType}`);
    }

    res.status(200).send('Event acknowledged');
  });

  // Admin Analytics (Protected)
  app.get('/api/admin/analytics', requireAdmin, (_req: Request, res: Response) => {
    res.json(getAnalytics());
  });

  // FAQs: Public read, Admin write
  app.get('/api/faqs', (_req: Request, res: Response) => {
    res.json(getFAQs());
  });

  app.post('/api/admin/faqs', requireAdmin, (req: Request, res: Response) => {
    const { faq } = req.body;
    const adminUser = (req as any).adminUser || 'Admin';
    const created = createFAQ(faq, adminUser);
    res.json({ success: true, faq: created });
  });

  app.put('/api/admin/faqs/:id', requireAdmin, (req: Request, res: Response) => {
    const { updates } = req.body;
    const adminUser = (req as any).adminUser || 'Admin';
    const updated = updateFAQ(req.params.id, updates, adminUser);
    res.json({ success: true, faq: updated });
  });

  app.delete('/api/admin/faqs/:id', requireAdmin, (req: Request, res: Response) => {
    const adminUser = (req as any).adminUser || 'Admin';
    const ok = deleteFAQ(req.params.id, adminUser);
    res.json({ success: ok });
  });

  // Audit Logs (Protected)
  app.get('/api/admin/audit-logs', requireAdmin, (_req: Request, res: Response) => {
    res.json(getAuditLogs());
  });

  // Notifications (Protected)
  app.get('/api/admin/notifications', requireAdmin, (_req: Request, res: Response) => {
    res.json(getNotifications());
  });

  app.post('/api/admin/notifications/:id/read', requireAdmin, (req: Request, res: Response) => {
    const ok = markNotificationRead(req.params.id);
    res.json({ success: ok });
  });

  app.post('/api/admin/notifications/read-all', requireAdmin, (_req: Request, res: Response) => {
    const ok = markAllNotificationsRead();
    res.json({ success: ok });
  });

  // Inventory Management (Protected)
  app.get(['/api/inventory', '/api/admin/inventory'], requireAdmin, (_req: Request, res: Response) => {
    res.json(getInventory());
  });

  app.post(['/api/inventory', '/api/admin/inventory'], requireAdmin, (req: Request, res: Response) => {
    const { item } = req.body;
    const adminUser = (req as any).adminUser || 'Admin';
    const created = addInventoryItem(item, adminUser);
    res.json({ success: true, item: created });
  });

  app.put(['/api/inventory/:id', '/api/admin/inventory/:id'], requireAdmin, (req: Request, res: Response) => {
    const { updates } = req.body;
    const adminUser = (req as any).adminUser || 'Admin';
    try {
      const updated = updateInventoryItem(req.params.id, updates, adminUser);
      res.json({ success: !!updated, item: updated });
    } catch (err: any) {
      res.status(409).json({ error: err.message });
    }
  });

  app.delete(['/api/inventory/:id', '/api/admin/inventory/:id'], requireAdmin, (req: Request, res: Response) => {
    const adminUser = (req as any).adminUser || 'Admin';
    const ok = deleteInventoryItem(req.params.id, adminUser);
    res.json({ success: ok });
  });

  // Catch-all for API routes: Ensure unknown /api endpoints return JSON 404 instead of falling into Vite SPA HTML
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // ----------------- Vite & Static Asset Handling -----------------

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PlayVault Ghana server running on http://0.0.0.0:${PORT}`);
    // Safe startup verification of active email provider credentials
    verifyEmailTransporter().catch((err) => {
      console.warn('[Startup] Email transporter check note:', err.message);
    });
  });
}

startServer();
