import { AccountTypeConfig, Game, SiteSettings, FAQItem, Order } from '../types';

export const initialSiteSettings: SiteSettings = {
  storeName: 'ReyGames',
  logoText: 'ReyGames',
  supportWhatsApp: '',
  supportEmail: '',
  announcement: 'Ghana PlayStation Store • Verified Paystack Checkout in GHS',
  deliveryMessage: 'Please allow up to 30 minutes for account details and setup instructions to be prepared.',
  exchangeRateUSDToGHS: 15.50,
  exchangeRateLastUpdated: new Date().toISOString(),
  exchangeRateUpdatedBy: 'Admin',
  catalogCurrency: 'USD',
  paymentCurrency: 'GHS',
  bannerTitle: 'Play More. Pay Less in Ghana.',
  bannerSubtitle: 'Get verified PS4 & PS5 digital games priced in USD, converted transparently at checkout to GHS with Ghana Paystack.',
  showTutorialVideos: true,
  tutorialSectionTitle: 'How to Set Up Your PSN Account',
  tutorialSectionSubtitle: 'Need help setting up your PlayStation account? Watch our quick PS4 or PS5 tutorial before getting started.',
  ps5TutorialTitle: 'PS5 Account Setup',
  ps5TutorialUrl: 'https://youtu.be/xiz5uyCTjBk',
  ps5TutorialDesc: 'Learn how to add and set up your PSN account on PS5.',
  ps4TutorialTitle: 'PS4 Account Setup',
  ps4TutorialUrl: 'https://youtu.be/TmaGY511fxA',
  ps4TutorialDesc: 'Learn how to add and set up your PSN account on PS4.',
  firstPurchaseDiscountEnabled: true,
  firstPurchaseDiscountAmountUSD: 1.00,
  adminNotificationEmail: '',
  adminNotificationEmailEnabled: true,
};

export const initialAccountTypes: AccountTypeConfig[] = [
  {
    id: 'primary-shared',
    name: 'Primary — Shared',
    badge: 'Standard',
    defaultPriceUSD: 14.00,
    description: 'Play on your personal PlayStation profile with your own PSN ID, trophies, and saves.',
    canChangeCredentials: false,
    rules: [
      'Play the purchased game on your personal PlayStation profile with your own saves and trophies.',
      'Do NOT change account credentials (email, password, online ID, or security settings).',
      'Do NOT log in to the provided account on multiple consoles.',
      'Do NOT disable 2-Factor Authentication (2FA) or tamper with security.',
      'PS4 accounts must NOT be installed or activated on PS5.',
      'Do NOT delete or sign out of the provided account after game installation.',
    ],
    setupInstructions: '1. Create a new user on your PS4/PS5.\n2. Sign in with the provided account credentials.\n3. Enable Console Sharing (PS5) or Primary PS4 (PS4).\n4. Go to Game Library, start download.\n5. Switch back to your personal PSN profile and play.',
    isActive: true,
  },
  {
    id: 'primary-non-sharing',
    name: 'Primary — Non-Sharing',
    badge: 'Solo Slot',
    defaultPriceUSD: 20.00,
    description: 'Solo dedicated Primary activation. Play on your personal profile with exclusive access to the console slot.',
    canChangeCredentials: false,
    rules: [
      'Exclusive solo Primary user on the account.',
      'Play the purchased game on your personal PlayStation profile with your own trophies and cloud saves.',
      'Do NOT alter email, password, online ID, or security settings.',
      'Do NOT log in to the account on multiple consoles.',
      'Do NOT disable 2FA or modify account security.',
      'PS4 accounts must NOT be installed or activated on PS5.',
      'Do NOT delete the provided profile from your console after downloading.',
    ],
    setupInstructions: '1. Add a new user on your console.\n2. Log in with the provided credentials.\n3. Ensure Primary activation / Console Sharing is enabled.\n4. Go to Game Library and initiate the download.\n5. Switch to your personal PlayStation profile and play anytime.',
    isActive: true,
  },
  {
    id: 'secondary',
    name: 'Secondary',
    badge: 'Economy',
    defaultPriceUSD: 10.00,
    description: 'Play directly through the provided account profile. Requires an active internet connection while playing.',
    canChangeCredentials: false,
    rules: [
      'Do NOT activate the account as Primary on your console (keep Console Sharing disabled).',
      'You must launch and play the game directly through the provided profile.',
      'An active internet connection is required during gameplay.',
      'Do NOT alter email, password, online ID, or security settings.',
      'Do NOT log in on multiple consoles.',
      'Do NOT disable 2FA or modify account security.',
      'PS4 accounts must NOT be installed on PS5.',
    ],
    setupInstructions: '1. Create a new user on your PS4/PS5.\n2. Sign in with the provided account details.\n3. Make sure Console Sharing / Primary Activation is DISABLED.\n4. Download the game from the Game Library.\n5. Stay connected to the internet and launch the game directly from this user profile.',
    isActive: true,
  },
  {
    id: 'full-private',
    name: 'Full Private',
    badge: 'Full Ownership',
    defaultPriceUSD: 35.00,
    description: 'Full private exclusive account. You are permitted to change the email and password to your own credentials after delivery.',
    canChangeCredentials: true,
    rules: [
      'Full exclusive ownership of the account.',
      'You are permitted to change the email and password to your personal credentials.',
      'Account is 100% private and never shared with any other player.',
      'Enjoy full control over online play, cloud saves, and account settings.',
    ],
    setupInstructions: '1. Log in to the account via PlayStation console or official PlayStation website.\n2. Navigate to Account Management > Security.\n3. Update the email address and password to your personal credentials.\n4. Activate 2FA on your phone.\n5. Download and enjoy full private ownership forever.',
    isActive: true,
  },
];

// START COMPLETELY EMPTY: NO SEEDED/FAKE GAMES
export const initialGames: Game[] = [];

// START COMPLETELY EMPTY: NO SEEDED/FAKE ORDERS
export const sampleInitialOrders: Order[] = [];

// START COMPLETELY EMPTY: NO FAKE FAQS UNTIL CREATED BY ADMIN
export const initialFAQs: FAQItem[] = [];
