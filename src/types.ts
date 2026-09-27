export type ConsoleType = 'PS4' | 'PS5';

export type AccountTypeId = 'primary-shared' | 'primary-non-sharing' | 'secondary' | 'full-private';

export interface AccountTypeConfig {
  id: AccountTypeId;
  name: string;
  badge: string;
  defaultPriceUSD: number;
  description: string;
  rules: string[];
  setupInstructions: string;
  isActive: boolean;
  canChangeCredentials: boolean; // false for Primary & Secondary, true for Full Private
  sortOrder?: number;
}

export interface Game {
  id: string;
  title: string;
  slug: string;
  coverImage: string;
  coverImageUrl?: string;
  cloudinaryPublicId?: string;
  description: string;
  genre: string;
  publisher?: string;
  ps4Available: boolean;
  ps5Available: boolean;
  isActive: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  restoredAt?: string;
  restoredBy?: string;
  isFeatured: boolean;
  sortOrder: number;
  accountPrices: {
    'primary-shared'?: number;
    'primary-non-sharing'?: number;
    'secondary'?: number;
    'full-private'?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus = 'PENDING_PAYMENT' | 'PAID' | 'PAYMENT_FAILED';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'AWAITING_FULFILLMENT'
  | 'PROCESSING'
  | 'DELIVERY_FAILED'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface DeliveryInformation {
  accountEmail: string;
  accountPassword: string;
  setupInstructions: string;
  backupCodes?: string;
  notes?: string;
  fulfilledAt: string;
  fulfilledBy?: string;
  deliveryEmailStatus?: DeliveryEmailStatus;
  deliveryEmailSentAt?: string;
  deliveryEmailAttempts?: number;
  deliveryEmailProvider?: string;
  deliveryEmailError?: string;
  deliveryEmailMessageId?: string;
  isReleased?: boolean;
  releasedAt?: string;
  releasedBy?: string;
}

export type DeliveryEmailStatus = 'PENDING' | 'SENDING' | 'SENT' | 'ACCEPTED' | 'FAILED' | 'DELIVERED' | 'BOUNCED';

export type AccountUsageMode = 'exclusive' | 'shared';

export interface InventoryAssignment {
  id: string;
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  console: ConsoleType;
  accountTypeId: AccountTypeId;
  status: 'reserved' | 'delivered' | 'cancelled';
  assignedAt: string;
  deliveredAt?: string;
  assignedBy?: string;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. PSG-20260920-0001
  secureToken: string; // Secret token for secure customer order viewing
  userId?: string; // Firebase Auth UID for Google authenticated customers
  customerName: string;
  customerEmail: string;
  customerPhone: string; // WhatsApp number
  gameId: string;
  gameTitleSnapshot: string;
  gameCoverSnapshot: string;
  console: ConsoleType;
  accountTypeId: AccountTypeId;
  accountTypeSnapshot: string;
  priceUSD: number;
  exchangeRate: number; // e.g. 15.50
  amountGHS: number; // e.g. 310.00
  currency: 'GHS';
  paystackReference: string;
  paystackVerificationData?: any;
  paystackVerifiedAt?: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  paymentChannel?: string;
  paidAt?: string;
  deliveryInformation?: DeliveryInformation;
  termsAccepted: boolean;
  termsAcceptedAt: string;
  createdAt: string;
  updatedAt: string;

  // Customer Fulfillment Delivery Email Status Tracking
  deliveryEmailStatus?: DeliveryEmailStatus;
  deliveryEmailSentAt?: string;
  deliveryEmailAttempts?: number;
  deliveryEmailProvider?: string;
  deliveryEmailError?: string;
  deliveryEmailMessageId?: string;

  // First-purchase discount details snapshot (locked server-side)
  isGoogleAccount?: boolean;
  customerType?: 'GOOGLE' | 'GUEST';
  customerGoogleUid?: string;
  originalPriceUSD?: number;
  discountUSD?: number;
  finalPriceUSD?: number;
  discountType?: 'FIRST_GAME_PURCHASE' | 'NONE';
  discountStatus?: 'APPLIED' | 'NONE';
  discountEligibility?: string;
  discountUsed?: boolean;

  // Admin Instant Purchase Email Notification Tracking (Idempotency)
  adminPurchaseNotificationSent?: boolean;
  adminPurchaseNotificationSentAt?: string;
}

export interface FirstPurchaseEligibilityResponse {
  eligible: boolean;
  discountUSD: number;
  promotionEnabled: boolean;
  reason?: 'eligible' | 'already_used' | 'disabled' | 'not_authenticated' | 'has_pending_order';
  user?: {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
  };
}

export interface SiteSettings {
  storeName: string;
  logoText: string;
  supportWhatsApp: string;
  supportEmail: string;
  announcement: string;
  deliveryMessage: string;
  exchangeRateUSDToGHS: number;
  exchangeRateLastUpdated: string;
  exchangeRateUpdatedBy: string;
  catalogCurrency: 'USD';
  paymentCurrency: 'GHS';
  paystackPublicKey?: string;
  bannerTitle: string;
  bannerSubtitle: string;
  footerText?: string;
  updatedAt?: string;

  // Tutorial Videos Section
  showTutorialVideos?: boolean;
  tutorialSectionTitle?: string;
  tutorialSectionSubtitle?: string;
  ps5TutorialTitle?: string;
  ps5TutorialUrl?: string;
  ps5TutorialDesc?: string;
  ps4TutorialTitle?: string;
  ps4TutorialUrl?: string;
  ps4TutorialDesc?: string;

  // First Purchase Discount Promotion (Admin Configurable)
  firstPurchaseDiscountEnabled?: boolean;
  firstPurchaseDiscountAmountUSD?: number;

  // Admin Instant Purchase Email Notifications
  adminNotificationEmail?: string;
  adminNotificationEmailEnabled?: boolean;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'accounts' | 'payment' | 'warranty';
  sortOrder: number;
  isActive: boolean;
}

export interface AuditLog {
  id: string;
  adminUser: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface AdminNotification {
  id: string;
  type: 'NEW_ORDER' | 'PAYMENT_SUCCESS' | 'ORDER_FULFILLED' | 'REFUND_REQUEST' | 'LOW_INVENTORY';
  title: string;
  message: string;
  orderId?: string;
  orderNumber?: string;
  read: boolean;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  gameId: string;
  console: ConsoleType;
  accountTypeId: AccountTypeId;
  accountEmail: string;
  accountPassword: string;
  additionalNotes?: string;
  notes?: string;
  backupCodes?: string;
  status: 'available' | 'reserved' | 'assigned' | 'delivered' | 'disabled';
  assignedOrderId?: string;

  // Account usage mode & sharing capacity
  usageMode?: AccountUsageMode; // 'exclusive' | 'shared'
  maxAssignments?: number; // max concurrent active slots (default 1 for exclusive, 2 for shared)
  assignments?: InventoryAssignment[];

  createdAt: string;
  updatedAt: string;
}
