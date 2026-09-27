import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc as rawSetDoc,
  updateDoc as rawUpdateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  setLogLevel,
} from 'firebase/firestore';
import { Game, Order, SiteSettings, AccountTypeConfig, FAQItem, AuditLog, AdminNotification, InventoryItem, InventoryAssignment, AccountUsageMode, DeliveryEmailStatus } from '../src/types';
import { initialAccountTypes, initialSiteSettings } from '../src/data/initialData';
import firebaseConfig from '../firebase-applet-config.json';
import { sendAdminPurchaseNotification } from './email';
import { verifyPaystackTransaction } from './paystack';

// Silence benign internal gRPC idle stream disconnection messages
setLogLevel('silent');

// Initialize Firebase SDK for server database operations
const app = initializeApp(firebaseConfig);
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

function isFirestoreSpecialObject(val: any): boolean {
  if (!val || typeof val !== 'object') return false;
  // FieldValue (deleteField, serverTimestamp, arrayUnion, arrayRemove, increment)
  if (
    val._methodName ||
    val.constructor?.name === 'FieldValue' ||
    val.constructor?.name === 'DeleteFieldValueImpl' ||
    val.constructor?.name === 'NumericIncrementTransform' ||
    (val as any)._delegate?.constructor?.name === 'FieldValue'
  ) {
    return true;
  }
  // Timestamp
  if (typeof val.toMillis === 'function' && typeof val.seconds === 'number') {
    return true;
  }
  // GeoPoint
  if (typeof val.latitude === 'number' && typeof val.longitude === 'number' && typeof val.isEqual === 'function') {
    return true;
  }
  // DocumentReference
  if (val.firestore && typeof val.path === 'string' && typeof val.id === 'string') {
    return true;
  }
  // Bytes / Blob
  if (val.constructor?.name === 'Bytes' || (typeof val.toBase64 === 'function' && typeof val.toUint8Array === 'function')) {
    return true;
  }
  return false;
}

/**
 * Deeply purges all `undefined` values from an object or array so it is safe for Firestore serialization.
 * Firestore client and admin SDKs throw an unhandled exception if ANY field or subfield is `undefined`.
 */
export function cleanFirestoreData<T>(input: T): T {
  if (input === null || input === undefined) {
    return null as any;
  }
  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as any;
  }
  if (typeof input === 'object') {
    if (input instanceof Date) {
      return input;
    }
    if (isFirestoreSpecialObject(input)) {
      return input;
    }

    const output: Record<string, any> = {};
    for (const key of Object.keys(input as Record<string, any>)) {
      const val = (input as any)[key];
      if (val !== undefined) {
        const cleanedVal = cleanFirestoreData(val);
        if (cleanedVal !== undefined) {
          output[key] = cleanedVal;
        }
      }
    }
    return output as T;
  }
  return input;
}

/**
 * In-place mutation helper to purge undefined properties from in-memory objects
 */
export function purgeUndefinedValues(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    for (let i = obj.length - 1; i >= 0; i--) {
      if (obj[i] === undefined) {
        obj.splice(i, 1);
      } else {
        purgeUndefinedValues(obj[i]);
      }
    }
    return obj;
  }
  if (typeof obj === 'object') {
    if (obj instanceof Date || isFirestoreSpecialObject(obj)) return obj;
    for (const key of Object.keys(obj)) {
      if (obj[key] === undefined) {
        delete obj[key];
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        purgeUndefinedValues(obj[key]);
      }
    }
  }
  return obj;
}

/**
 * Safe wrapper around Firestore setDoc:
 * 1. Deeply sanitizes undefined fields to avoid "Unsupported field value: undefined" fatal errors
 * 2. Catches any synchronous validation errors thrown by the Firestore SDK
 * 3. Catches asynchronous rejections and logs cleanly without crashing express endpoints
 */
export function setDoc(
  docRef: any,
  data: any,
  options?: { merge?: boolean }
): Promise<void> {
  try {
    purgeUndefinedValues(data);
    const cleaned = cleanFirestoreData(data);
    const p = options ? rawSetDoc(docRef, cleaned, options) : rawSetDoc(docRef, cleaned);
    return p.catch((err: any) => {
      console.warn(`[Firestore setDoc] Error writing to ${docRef?.path || 'doc'}:`, err.message);
    });
  } catch (err: any) {
    console.warn(`[Firestore setDoc] Synchronous validation note for ${docRef?.path || 'doc'}:`, err.message);
    return Promise.resolve();
  }
}

/**
 * Safe wrapper around Firestore updateDoc:
 * 1. Deeply sanitizes undefined fields to avoid "Unsupported field value: undefined" fatal errors
 * 2. Catches any synchronous validation errors thrown by the Firestore SDK
 * 3. Catches asynchronous rejections and logs cleanly without crashing express endpoints
 */
export function updateDoc(
  docRef: any,
  data: any
): Promise<void> {
  try {
    purgeUndefinedValues(data);
    const cleaned = cleanFirestoreData(data);
    const p = rawUpdateDoc(docRef, cleaned);
    return p.catch((err: any) => {
      console.warn(`[Firestore updateDoc] Error writing to ${docRef?.path || 'doc'}:`, err.message);
    });
  } catch (err: any) {
    console.warn(`[Firestore updateDoc] Synchronous validation note for ${docRef?.path || 'doc'}:`, err.message);
    return Promise.resolve();
  }
}

export interface DatabaseState {
  settings: SiteSettings;
  games: Game[];
  accountTypes: AccountTypeConfig[];
  orders: Order[];
  inventory: InventoryItem[];
  faqs: FAQItem[];
  auditLogs: AuditLog[];
  notifications: AdminNotification[];
}

// Initial state with NO fake products, NO fake orders, NO fake customers, NO fake inventory
const state: DatabaseState = {
  settings: { ...initialSiteSettings },
  games: [],
  accountTypes: [...initialAccountTypes],
  orders: [],
  inventory: [],
  faqs: [],
  auditLogs: [],
  notifications: [],
};

const DB_FILE = path.join(process.cwd(), 'data', 'db_store.json');

export function saveToDisk(): void {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('[Storage] Disk save note:', e.message);
  }
}

function loadFromDisk(): void {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const loaded = JSON.parse(raw);
      if (Array.isArray(loaded.games) && loaded.games.length > 0) state.games = loaded.games;
      if (Array.isArray(loaded.orders) && loaded.orders.length > 0) state.orders = loaded.orders;
      if (loaded.settings) state.settings = { ...state.settings, ...loaded.settings };
      if (Array.isArray(loaded.accountTypes) && loaded.accountTypes.length > 0) state.accountTypes = loaded.accountTypes;
      if (Array.isArray(loaded.inventory)) state.inventory = loaded.inventory;
      if (Array.isArray(loaded.faqs)) state.faqs = loaded.faqs;
      if (Array.isArray(loaded.auditLogs)) state.auditLogs = loaded.auditLogs;
      if (Array.isArray(loaded.notifications)) state.notifications = loaded.notifications;
      purgeUndefinedValues(state);
      console.log(`[Storage] Loaded state from disk. Games: ${state.games.length}, Orders: ${state.orders.length}`);
    }
  } catch (e: any) {
    console.warn('[Storage] Disk load note:', e.message);
  }
}

// Load initial disk state immediately and sanitize undefined values
loadFromDisk();
purgeUndefinedValues(state);

let isInitialized = false;

// Async initial sync from Firestore on cold start
export async function initializeFromFirestore(): Promise<void> {
  if (isInitialized) return;
  try {
    // 1. Load Settings
    const settingsSnap = await getDoc(doc(firestoreDb, 'siteSettings', 'config'));
    if (settingsSnap.exists()) {
      state.settings = { ...initialSiteSettings, ...state.settings, ...(settingsSnap.data() as SiteSettings) };
      if (state.settings.storeName === 'PlayVault Ghana' || !state.settings.storeName) {
        state.settings.storeName = 'ReyGames';
        state.settings.logoText = 'ReyGames';
      }
      if (state.settings.showTutorialVideos === undefined) {
        state.settings.showTutorialVideos = true;
        state.settings.tutorialSectionTitle = state.settings.tutorialSectionTitle || initialSiteSettings.tutorialSectionTitle;
        state.settings.tutorialSectionSubtitle = state.settings.tutorialSectionSubtitle || initialSiteSettings.tutorialSectionSubtitle;
        state.settings.ps5TutorialTitle = state.settings.ps5TutorialTitle || initialSiteSettings.ps5TutorialTitle;
        state.settings.ps5TutorialUrl = state.settings.ps5TutorialUrl || initialSiteSettings.ps5TutorialUrl;
        state.settings.ps5TutorialDesc = state.settings.ps5TutorialDesc || initialSiteSettings.ps5TutorialDesc;
        state.settings.ps4TutorialTitle = state.settings.ps4TutorialTitle || initialSiteSettings.ps4TutorialTitle;
        state.settings.ps4TutorialUrl = state.settings.ps4TutorialUrl || initialSiteSettings.ps4TutorialUrl;
        state.settings.ps4TutorialDesc = state.settings.ps4TutorialDesc || initialSiteSettings.ps4TutorialDesc;
      }
      if (state.settings.firstPurchaseDiscountEnabled === undefined) {
        state.settings.firstPurchaseDiscountEnabled = true;
      }
      if (state.settings.firstPurchaseDiscountAmountUSD === undefined) {
        state.settings.firstPurchaseDiscountAmountUSD = 1.00;
      }
      if (!state.settings.adminNotificationEmail) {
        state.settings.adminNotificationEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || 'oforir74444@gmail.com';
      }
      if (state.settings.adminNotificationEmailEnabled === undefined) {
        state.settings.adminNotificationEmailEnabled = true;
      }
      await setDoc(doc(firestoreDb, 'siteSettings', 'config'), state.settings, { merge: true });
    } else {
      // Seed Firestore with initial settings
      await setDoc(doc(firestoreDb, 'siteSettings', 'config'), state.settings, { merge: true });
    }

    // 2. Load Games
    const gamesSnap = await getDocs(collection(firestoreDb, 'games'));
    const loadedGames: Game[] = [];
    gamesSnap.forEach((d) => loadedGames.push({ id: d.id, ...(d.data() as any) }));
    if (loadedGames.length > 0) {
      state.games = loadedGames;
    } else if (state.games.length > 0) {
      // Seed Firestore with games if empty
      for (const g of state.games) {
        await setDoc(doc(firestoreDb, 'games', g.id), g, { merge: true });
      }
    }

    // 3. Load Account Types
    const accSnap = await getDocs(collection(firestoreDb, 'accountTypes'));
    const loadedAcc: AccountTypeConfig[] = [];
    accSnap.forEach((d) => loadedAcc.push({ id: d.id, ...(d.data() as any) }));
    if (loadedAcc.length > 0) {
      state.accountTypes = loadedAcc;
    } else if (state.accountTypes.length > 0) {
      for (const a of state.accountTypes) {
        await setDoc(doc(firestoreDb, 'accountTypes', a.id), a, { merge: true });
      }
    }

    // 4. Load & Intelligently Reconcile Orders between Disk and Firestore
    const ordersSnap = await getDocs(collection(firestoreDb, 'orders'));
    const firestoreOrdersMap = new Map<string, Order>();
    ordersSnap.forEach((d) => {
      firestoreOrdersMap.set(d.id, { id: d.id, ...(d.data() as any) });
    });

    const reconciledOrdersMap = new Map<string, Order>();
    // Start with all orders currently in memory / loaded from disk
    for (const diskOrder of state.orders) {
      const fsOrder = firestoreOrdersMap.get(diskOrder.id);
      if (!fsOrder) {
        // Exists on disk but not in Firestore: sync to Firestore
        reconciledOrdersMap.set(diskOrder.id, diskOrder);
        setDoc(doc(firestoreDb, 'orders', diskOrder.id), diskOrder, { merge: true }).catch(() => {});
      } else {
        // Exists in both: preserve advanced state (e.g. PAID / FULFILLED)
        if (diskOrder.paymentStatus === 'PAID' && fsOrder.paymentStatus !== 'PAID') {
          reconciledOrdersMap.set(diskOrder.id, diskOrder);
          setDoc(doc(firestoreDb, 'orders', diskOrder.id), diskOrder, { merge: true }).catch(() => {});
        } else if (diskOrder.orderStatus === 'FULFILLED' && fsOrder.orderStatus !== 'FULFILLED') {
          reconciledOrdersMap.set(diskOrder.id, diskOrder);
          setDoc(doc(firestoreDb, 'orders', diskOrder.id), diskOrder, { merge: true }).catch(() => {});
        } else {
          // Compare updatedAt timestamps
          const diskTime = new Date(diskOrder.updatedAt || 0).getTime();
          const fsTime = new Date(fsOrder.updatedAt || 0).getTime();
          if (diskTime >= fsTime) {
            reconciledOrdersMap.set(diskOrder.id, diskOrder);
          } else {
            reconciledOrdersMap.set(diskOrder.id, fsOrder);
          }
        }
      }
    }

    // Add any orders in Firestore that weren't on disk
    for (const [id, fsOrder] of firestoreOrdersMap.entries()) {
      if (!reconciledOrdersMap.has(id)) {
        reconciledOrdersMap.set(id, fsOrder);
      }
    }

    state.orders = Array.from(reconciledOrdersMap.values());
    saveToDisk();

    // 5. Load FAQs
    const faqsSnap = await getDocs(collection(firestoreDb, 'faqs'));
    const loadedFaqs: FAQItem[] = [];
    faqsSnap.forEach((d) => loadedFaqs.push({ id: d.id, ...(d.data() as any) }));
    if (loadedFaqs.length > 0) {
      state.faqs = loadedFaqs;
    } else if (state.faqs.length > 0) {
      for (const f of state.faqs) {
        await setDoc(doc(firestoreDb, 'faqs', f.id), f, { merge: true });
      }
    }

    // 6. Load Inventory (Never wipe out disk inventory with empty Firestore array)
    const invSnap = await getDocs(collection(firestoreDb, 'inventory'));
    const loadedInv: InventoryItem[] = [];
    invSnap.forEach((d) => loadedInv.push({ id: d.id, ...(d.data() as any) }));
    if (loadedInv.length > 0) {
      state.inventory = loadedInv;
    }

    // 7. Load Audit Logs
    const logSnap = await getDocs(collection(firestoreDb, 'auditLogs'));
    const loadedLogs: AuditLog[] = [];
    logSnap.forEach((d) => loadedLogs.push({ id: d.id, ...(d.data() as any) }));
    if (loadedLogs.length > 0) {
      state.auditLogs = loadedLogs;
    }

    // 8. Load Notifications
    const notifSnap = await getDocs(collection(firestoreDb, 'notifications'));
    const loadedNotifs: AdminNotification[] = [];
    notifSnap.forEach((d) => loadedNotifs.push({ id: d.id, ...(d.data() as any) }));
    if (loadedNotifs.length > 0) {
      state.notifications = loadedNotifs;
    }

    // 9. Load First Purchase Redemptions
    try {
      const redemptionsSnap = await getDocs(collection(firestoreDb, 'firstPurchaseRedemptions'));
      redemptionsSnap.forEach((d) => firstPurchaseUsedUids.add(d.id));
      state.orders.forEach((o) => {
        if (
          o.paymentStatus === 'PAID' &&
          o.customerGoogleUid &&
          (o.discountStatus === 'APPLIED' || o.discountUsed)
        ) {
          firstPurchaseUsedUids.add(o.customerGoogleUid);
        }
      });
    } catch (redemptionErr) {
      // Non-blocking
    }

    isInitialized = true;
    console.log(`[Firestore] Connected & Synced. Active Games: ${state.games.length}, Orders: ${state.orders.length}`);
  } catch (err: any) {
    console.warn('[Firestore] Initial sync note:', err.message);
    isInitialized = true;
  }
}

// Kick off initial sync non-blockingly
initializeFromFirestore().catch((err) => console.warn('Sync error:', err));

// ---------------- Site Settings ----------------

export function getSettings(): SiteSettings {
  return state.settings;
}

export function updateSettings(newSettings: Partial<SiteSettings>, adminUser: string = 'Admin'): SiteSettings {
  const previousRate = state.settings.exchangeRateUSDToGHS;
  state.settings = {
    ...state.settings,
    ...newSettings,
    updatedAt: new Date().toISOString(),
  };

  if (newSettings.exchangeRateUSDToGHS && newSettings.exchangeRateUSDToGHS !== previousRate) {
    state.settings.exchangeRateLastUpdated = new Date().toISOString();
    state.settings.exchangeRateUpdatedBy = adminUser;
    addAuditLog(
      adminUser,
      'EXCHANGE_RATE_UPDATE',
      `Exchange rate updated from GH₵ ${previousRate.toFixed(2)} to GH₵ ${newSettings.exchangeRateUSDToGHS.toFixed(2)} per $1.00 USD.`
    );
  }

  // Persist to Firestore asynchronously
  setDoc(doc(firestoreDb, 'siteSettings', 'config'), state.settings, { merge: true }).catch((err) =>
    console.warn('Error persisting settings to Firestore:', err.message)
  );
  saveToDisk();

  return state.settings;
}

// ---------------- Games Catalog ----------------

export function getGames(includeInactive: boolean = false): Game[] {
  if (includeInactive) {
    return state.games;
  }
  return state.games.filter((g) => g.isActive && !g.isArchived);
}

export function getGameById(id: string): Game | undefined {
  return state.games.find((g) => g.id === id || g.slug === id);
}

export function createGame(gameData: Omit<Game, 'id'>, adminUser: string = 'Admin'): Game {
  const id = (gameData as any).id || `game_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newGame: Game = {
    ...gameData,
    id,
    isActive: gameData.isActive !== false,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.games.push(newGame);

  addAuditLog(adminUser, 'GAME_CREATED', `Added new PlayStation game: "${newGame.title}"`);

  // Persist to Firestore
  setDoc(doc(firestoreDb, 'games', id), newGame, { merge: true }).catch((err) =>
    console.warn('Error saving game to Firestore:', err.message)
  );
  saveToDisk();

  return newGame;
}

export function updateGame(id: string, updates: Partial<Game>, adminUser: string = 'Admin'): Game | null {
  const index = state.games.findIndex((g) => g.id === id);
  if (index === -1) return null;

  const existing = state.games[index];
  const updated: Game = {
    ...existing,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  state.games[index] = updated;

  addAuditLog(adminUser, 'GAME_UPDATED', `Updated details for game: "${updated.title}"`);

  // Persist to Firestore
  setDoc(doc(firestoreDb, 'games', id), updated, { merge: true }).catch((err) =>
    console.warn('Error updating game in Firestore:', err.message)
  );
  saveToDisk();

  return updated;
}

export function hasOrdersForGame(id: string): boolean {
  const target = state.games.find((g) => g.id === id);
  if (!target) return false;
  return state.orders.some(
    (o) => o.gameId === id || (Boolean(o.gameTitleSnapshot) && o.gameTitleSnapshot.trim().toLowerCase() === target.title.trim().toLowerCase())
  );
}

export function archiveGame(id: string, adminUser: string = 'Admin'): { success: boolean; game?: Game; hasOrders: boolean } {
  const index = state.games.findIndex((g) => g.id === id);
  if (index === -1) return { success: false, hasOrders: false };

  const targetGame = state.games[index];
  const hasOrders = hasOrdersForGame(id);

  const archivedGame: Game = {
    ...targetGame,
    isActive: false,
    isArchived: true,
    archivedAt: new Date().toISOString(),
    archivedBy: adminUser,
    updatedAt: new Date().toISOString(),
  };

  state.games[index] = archivedGame;

  addAuditLog(
    adminUser,
    'GAME_ARCHIVED',
    `Archived game "${archivedGame.title}" (ID: ${id})${hasOrders ? ' — preserved past customer order history' : ' — safe archived'}`
  );

  // Persist to Firestore
  setDoc(doc(firestoreDb, 'games', id), archivedGame, { merge: true }).catch((err) =>
    console.warn('Error archiving game in Firestore:', err.message)
  );
  saveToDisk();

  return { success: true, game: archivedGame, hasOrders };
}

export function restoreGame(id: string, adminUser: string = 'Admin'): { success: boolean; game?: Game } {
  const index = state.games.findIndex((g) => g.id === id);
  if (index === -1) return { success: false };

  const targetGame = state.games[index];

  const restoredGame: Game = {
    ...targetGame,
    isActive: true,
    isArchived: false,
    restoredAt: new Date().toISOString(),
    restoredBy: adminUser,
    updatedAt: new Date().toISOString(),
  };

  state.games[index] = restoredGame;

  addAuditLog(adminUser, 'GAME_RESTORED', `Restored game to public storefront catalog: "${restoredGame.title}" (ID: ${id})`);

  // Persist to Firestore
  setDoc(doc(firestoreDb, 'games', id), restoredGame, { merge: true }).catch((err) =>
    console.warn('Error restoring game in Firestore:', err.message)
  );
  saveToDisk();

  return { success: true, game: restoredGame };
}

export function deleteGame(
  id: string,
  adminUser: string = 'Admin',
  forcePermanent: boolean = false
): { success: boolean; isArchived: boolean; hasOrders: boolean } {
  const index = state.games.findIndex((g) => g.id === id);
  if (index === -1) return { success: false, isArchived: false, hasOrders: false };

  const targetGame = state.games[index];
  const hasOrders = hasOrdersForGame(id);

  // If orders exist, or unless explicitly forcing permanent deletion, ALWAYS perform safe archiving
  if (hasOrders || !forcePermanent) {
    const archiveResult = archiveGame(id, adminUser);
    return { success: archiveResult.success, isArchived: true, hasOrders };
  }

  // Only permanently delete if explicitly forced AND zero orders reference it
  const title = targetGame.title;
  state.games.splice(index, 1);
  addAuditLog(adminUser, 'GAME_DELETED', `Permanently removed game with zero orders: "${title}" (ID: ${id})`);
  deleteDoc(doc(firestoreDb, 'games', id)).catch((err) =>
    console.warn('Error deleting game from Firestore:', err.message)
  );
  saveToDisk();

  return { success: true, isArchived: false, hasOrders: false };
}

// ---------------- Account Types ----------------

export function getAccountTypes(): AccountTypeConfig[] {
  return state.accountTypes;
}

export function createAccountType(data: Partial<AccountTypeConfig>, adminUser: string = 'Admin'): AccountTypeConfig {
  const id = (data.id || data.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || `tier-${Date.now()}`) as any;
  const newTier: AccountTypeConfig = {
    id,
    name: data.name || 'New Tier',
    badge: data.badge || 'Tier',
    defaultPriceUSD: typeof data.defaultPriceUSD === 'number' ? data.defaultPriceUSD : 15.0,
    description: data.description || '',
    rules: Array.isArray(data.rules) ? data.rules : [],
    setupInstructions: data.setupInstructions || '',
    isActive: data.isActive !== false,
    canChangeCredentials: Boolean(data.canChangeCredentials),
    sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : state.accountTypes.length + 1,
  };
  state.accountTypes.push(newTier);

  addAuditLog(adminUser, 'ACCOUNT_TYPE_CREATED', `Created new account tier: "${newTier.name}"`);

  setDoc(doc(firestoreDb, 'accountTypes', id), newTier, { merge: true }).catch((err) =>
    console.warn('Error creating account type in Firestore:', err.message)
  );
  saveToDisk();

  return newTier;
}

export function updateAccountType(id: string, updates: Partial<AccountTypeConfig>, adminUser: string = 'Admin'): AccountTypeConfig | null {
  const index = state.accountTypes.findIndex((a) => a.id === id);
  if (index === -1) return null;

  const updated = { ...state.accountTypes[index], ...updates };
  state.accountTypes[index] = updated;

  addAuditLog(adminUser, 'ACCOUNT_TYPE_UPDATED', `Updated account configuration: "${updated.name}"`);

  // Persist to Firestore
  setDoc(doc(firestoreDb, 'accountTypes', id), updated, { merge: true }).catch((err) =>
    console.warn('Error updating account type in Firestore:', err.message)
  );
  saveToDisk();

  return updated;
}

export function deleteAccountType(id: string, adminUser: string = 'Admin'): boolean {
  const index = state.accountTypes.findIndex((a) => a.id === id);
  if (index === -1) return false;

  const name = state.accountTypes[index].name;
  state.accountTypes.splice(index, 1);

  addAuditLog(adminUser, 'ACCOUNT_TYPE_DELETED', `Deleted account tier: "${name}" (ID: ${id})`);

  deleteDoc(doc(firestoreDb, 'accountTypes', id)).catch((err) =>
    console.warn('Error deleting account type from Firestore:', err.message)
  );
  saveToDisk();

  return true;
}

// ---------------- Orders & Fulfillment ----------------

export function getOrders(statusFilter?: string): Order[] {
  let list = [...state.orders];
  if (statusFilter && statusFilter !== 'ALL') {
    list = list.filter((o) => o.orderStatus === statusFilter || o.paymentStatus === statusFilter);
  }
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getOrderById(id: string): Order | undefined {
  if (!id || typeof id !== 'string') return undefined;
  const cleanId = id.trim().replace(/^#/, '');
  const lowerCleanId = cleanId.toLowerCase();
  return state.orders.find((o) => {
    const orderNumClean = o.orderNumber.replace(/^#/, '').toLowerCase();
    const orderIdLower = o.id.toLowerCase();
    const refLower = (o.paystackReference || '').toLowerCase();
    return (
      orderNumClean === lowerCleanId ||
      orderIdLower === lowerCleanId ||
      refLower === lowerCleanId ||
      o.orderNumber === id ||
      o.id === id
    );
  });
}

// Tracks Google UIDs that have completed their first purchase discount
const firstPurchaseUsedUids = new Set<string>();

export function checkUserFirstPurchaseEligibility(
  uid: string,
  email?: string
): {
  eligible: boolean;
  discountUSD: number;
  promotionEnabled: boolean;
  reason?: 'eligible' | 'already_used' | 'disabled' | 'not_authenticated' | 'has_pending_order';
} {
  const currentSettings = getSettings();
  const promotionEnabled = currentSettings.firstPurchaseDiscountEnabled !== false;
  const discountAmount = currentSettings.firstPurchaseDiscountAmountUSD ?? 1.00;

  if (!promotionEnabled) {
    return { eligible: false, discountUSD: 0, promotionEnabled: false, reason: 'disabled' };
  }

  if (!uid || typeof uid !== 'string') {
    return { eligible: false, discountUSD: 0, promotionEnabled: true, reason: 'not_authenticated' };
  }

  // Check if UID is in redeemed set
  if (firstPurchaseUsedUids.has(uid)) {
    return { eligible: false, discountUSD: 0, promotionEnabled: true, reason: 'already_used' };
  }

  // Double check paid orders in database
  const normalizedEmail = (email || '').trim().toLowerCase();
  const hasPaidOrder = state.orders.some((o) => {
    if (o.paymentStatus !== 'PAID') return false;
    if (o.customerGoogleUid && o.customerGoogleUid === uid) return true;
    if (
      o.discountStatus === 'APPLIED' &&
      normalizedEmail &&
      o.customerEmail.toLowerCase() === normalizedEmail
    ) {
      return true;
    }
    return false;
  });

  if (hasPaidOrder) {
    firstPurchaseUsedUids.add(uid);
    return { eligible: false, discountUSD: 0, promotionEnabled: true, reason: 'already_used' };
  }

  return { eligible: true, discountUSD: discountAmount, promotionEnabled: true, reason: 'eligible' };
}

export function recordFirstPurchaseUsed(uid: string, orderId: string, email?: string): void {
  if (!uid) return;
  firstPurchaseUsedUids.add(uid);
  const record = {
    uid,
    orderId,
    email: email || '',
    usedAt: new Date().toISOString(),
  };
  setDoc(doc(firestoreDb, 'firstPurchaseRedemptions', uid), record, { merge: true }).catch((err) =>
    console.warn('[Storage] Error persisting first purchase redemption to Firestore:', err.message)
  );
  addAuditLog(
    'Promotion Engine',
    'DISCOUNT_REDEEMED',
    `Customer Google UID ${uid} (${email || 'No email'}) redeemed first-purchase discount of $1.00 on order ${orderId}.`
  );
}

export function getOrderByReference(reference: string): Order | undefined {
  return state.orders.find((o) => o.paystackReference === reference);
}

/**
 * Authoritatively returns orders purchased by a verified Google customer UID.
 * Enforces strict customer data isolation:
 * - Returns ONLY orders matching the authenticated customer UID.
 * - Hides sensitive delivery credentials if order is not fulfilled.
 * - Strips admin internal notes before returning fulfilled delivery credentials.
 */
export function getOrdersForCustomer(userId: string): Order[] {
  if (!userId || typeof userId !== 'string') return [];
  const cleanUid = userId.trim();

  return state.orders
    .filter((o) => {
      const ownerUid = o.userId || o.customerGoogleUid;
      return ownerUid === cleanUid;
    })
    .map((o) => {
      const safeOrder = { ...o };
      if (safeOrder.orderStatus !== 'FULFILLED') {
        delete safeOrder.deliveryInformation;
      } else if (safeOrder.deliveryInformation) {
        const { notes, ...safeDelivery } = safeOrder.deliveryInformation;
        safeOrder.deliveryInformation = safeDelivery;
      }
      return safeOrder;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Authoritatively returns an individual order for an authenticated customer UID.
 * Enforces strict ownership validation:
 * - If order exists and matches user: returns sanitized order.
 * - If order exists and belongs to a different customer: returns 'FORBIDDEN'.
 * - If order does not exist: returns null.
 */
export function getCustomerOrderById(orderId: string, userId: string): Order | null | 'FORBIDDEN' {
  if (!orderId || !userId) return null;
  const cleanId = orderId.trim().replace(/^#/, '');
  const cleanUid = userId.trim();

  const order = state.orders.find((o) => o.id === cleanId || o.orderNumber === cleanId);
  if (!order) return null;

  const ownerUid = order.userId || order.customerGoogleUid;
  if (!ownerUid || ownerUid !== cleanUid) {
    return 'FORBIDDEN';
  }

  const safeOrder = { ...order };
  if (safeOrder.orderStatus !== 'FULFILLED') {
    delete safeOrder.deliveryInformation;
  } else if (safeOrder.deliveryInformation) {
    const { notes, ...safeDelivery } = safeOrder.deliveryInformation;
    safeOrder.deliveryInformation = safeDelivery;
  }
  return safeOrder;
}

export function createOrder(orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'updatedAt'>): Order {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `PSG-${dateStr}-${randomSuffix}`;
  const id = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const resolvedUserId = orderData.userId || orderData.customerGoogleUid || undefined;
  const resolvedGoogleUid = orderData.customerGoogleUid || orderData.userId || undefined;

  const newOrder: Order = {
    ...orderData,
    id,
    orderNumber,
    userId: resolvedUserId,
    customerGoogleUid: resolvedGoogleUid,
    isGoogleAccount: orderData.customerType === 'GOOGLE' || Boolean(resolvedUserId),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.orders.unshift(newOrder);

  // If this is a discounted first purchase for a Google user, cancel any stale unpaid pending orders for this user
  if (newOrder.discountStatus === 'APPLIED' && newOrder.customerGoogleUid) {
    state.orders.forEach((o) => {
      if (
        o.id !== newOrder.id &&
        o.customerGoogleUid === newOrder.customerGoogleUid &&
        o.paymentStatus === 'PENDING_PAYMENT' &&
        o.discountStatus === 'APPLIED'
      ) {
        o.paymentStatus = 'PAYMENT_FAILED';
        o.orderStatus = 'CANCELLED';
        o.updatedAt = new Date().toISOString();
        updateDoc(doc(firestoreDb, 'orders', o.id), {
          paymentStatus: 'PAYMENT_FAILED',
          orderStatus: 'CANCELLED',
          updatedAt: o.updatedAt,
        }).catch(() => {});
      }
    });
  }

  // Add admin notification
  addNotification(
    'NEW_ORDER',
    `New Order Placed - ${newOrder.gameTitleSnapshot}`,
    `${newOrder.customerName} initiated order ${newOrder.orderNumber} for GH₵ ${newOrder.amountGHS.toFixed(2)}.`,
    newOrder.id,
    newOrder.orderNumber
  );

  // Persist to Firestore
  setDoc(doc(firestoreDb, 'orders', id), newOrder).catch((err) =>
    console.warn('Error saving order to Firestore:', err.message)
  );
  saveToDisk();

  return newOrder;
}

export function markOrderPaid(reference: string, paymentChannel?: string, verificationData?: any): Order | null {
  const cleanRef = reference.trim();
  const order = state.orders.find(
    (o) =>
      o.paystackReference === cleanRef ||
      (o.paystackReference && o.paystackReference.trim().toLowerCase() === cleanRef.toLowerCase()) ||
      o.orderNumber === cleanRef ||
      o.id === cleanRef
  );
  if (!order) return null;

  // Protect against duplicate processing (Idempotent)
  if (order.paymentStatus === 'PAID') {
    if (order.orderStatus === 'PENDING_PAYMENT') {
      order.orderStatus = 'AWAITING_FULFILLMENT';
      order.updatedAt = new Date().toISOString();
      saveToDisk();
      setDoc(doc(firestoreDb, 'orders', order.id), order, { merge: true }).catch(() => {});
    }
    return order;
  }

  const prevPaymentStatus = order.paymentStatus;
  const prevOrderStatus = order.orderStatus;

  order.paymentStatus = 'PAID';
  order.orderStatus = 'AWAITING_FULFILLMENT';
  order.paidAt = new Date().toISOString();
  order.updatedAt = new Date().toISOString();
  if (paymentChannel) order.paymentChannel = paymentChannel;
  if (verificationData) {
    order.paystackVerificationData = verificationData;
  }

  console.log(
    `[PAYMENT STATE TRANSITION] Order: ${order.orderNumber} | Ref: ${order.paystackReference || cleanRef} | Payment: ${prevPaymentStatus} -> ${order.paymentStatus} | Status: ${prevOrderStatus} -> ${order.orderStatus} | Amount: GH₵ ${order.amountGHS.toFixed(2)}`
  );

  // Inventory auto-reservation: check if an available inventory account matches this game & slot
  const matchingInv = state.inventory.find(
    (i) =>
      i.gameId === order.gameId &&
      i.console === order.console &&
      i.accountTypeId === order.accountTypeId &&
      (i.status === 'available' ||
        (i.usageMode === 'shared' && (i.assignments?.length || 0) < (i.maxAssignments || 2)))
  );

  if (matchingInv) {
    const isShared = matchingInv.usageMode === 'shared';
    const currentAssignments = matchingInv.assignments || [];
    const maxCapacity = matchingInv.maxAssignments || (isShared ? 2 : 1);

    const newAssignment: InventoryAssignment = {
      id: `asgn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerEmail: order.customerEmail,
      console: order.console,
      accountTypeId: order.accountTypeId,
      assignedAt: new Date().toISOString(),
      status: 'reserved',
    };

    matchingInv.assignments = [...currentAssignments.filter((a) => a.orderId !== order.id), newAssignment];
    matchingInv.assignedOrderId = order.id;

    if (matchingInv.assignments.length >= maxCapacity) {
      matchingInv.status = 'reserved';
    } else {
      matchingInv.status = 'available';
    }

    matchingInv.updatedAt = new Date().toISOString();
    setDoc(doc(firestoreDb, 'inventory', matchingInv.id), matchingInv, { merge: true }).catch(() => {});
    addAuditLog(
      'System Inventory',
      'INVENTORY_RESERVED',
      `Reserved inventory account (${matchingInv.accountEmail}) for paid order ${order.orderNumber} (${matchingInv.assignments.length}/${maxCapacity} slots assigned).`
    );
  } else {
    addNotification(
      'LOW_INVENTORY',
      `Inventory Stock Required - ${order.orderNumber}`,
      `Order ${order.orderNumber} for ${order.gameTitleSnapshot} (${order.console} - ${order.accountTypeSnapshot}) is paid, but no matching accounts are currently available in inventory. Admin fulfillment required.`,
      order.id,
      order.orderNumber
    );
    addAuditLog(
      'System Inventory',
      'INVENTORY_OUT_OF_STOCK',
      `Paid order ${order.orderNumber} placed without available stock. Queued for manual admin inventory allocation.`
    );
  }

  addNotification(
    'PAYMENT_SUCCESS',
    `New Paid Order - ${order.orderNumber}`,
    `Paystack verified GH₵ ${order.amountGHS.toFixed(2)} received from ${order.customerName} (${order.customerEmail}) for ${order.gameTitleSnapshot} (${order.console} - ${order.accountTypeSnapshot}). Status: AWAITING FULFILLMENT.`,
    order.id,
    order.orderNumber
  );

  addAuditLog(
    'Paystack Gateway',
    'PAYMENT_VERIFIED',
    `Payment of GH₵ ${order.amountGHS.toFixed(2)} verified for order ${order.orderNumber} (Ref: ${order.paystackReference || reference}). Channel: ${paymentChannel || 'Paystack'}.`
  );

  // If first-purchase discount was applied, mark it permanently redeemed for this Google account
  if (order.discountStatus === 'APPLIED' && order.customerGoogleUid) {
    order.discountUsed = true;
    recordFirstPurchaseUsed(order.customerGoogleUid, order.id, order.customerEmail);
  }

  // Trigger Instant Admin Email Notification (Server-side, idempotent, non-blocking)
  if (!order.adminPurchaseNotificationSent) {
    order.adminPurchaseNotificationSent = true;
    order.adminPurchaseNotificationSentAt = new Date().toISOString();
    
    // Execute email notification asynchronously so order confirmation is never delayed
    sendAdminPurchaseNotification(order)
      .then((result) => {
        if (result.success) {
          console.log(`[Order ${order.orderNumber}] Admin purchase notification recorded (Provider: ${result.provider || 'default'}).`);
        }
      })
      .catch((err) => {
        // Even if the email service fails temporarily, the order remains PAID / AWAITING_FULFILLMENT.
        console.error(`[Order ${order.orderNumber}] Failed to deliver admin purchase email notification:`, err);
      });
  }

  // Persist to Firestore
  setDoc(doc(firestoreDb, 'orders', order.id), order, { merge: true }).catch((err) =>
    console.warn('Error updating order paid status in Firestore:', err.message)
  );
  saveToDisk();

  return order;
}

/**
 * Authoritative payment processor for Paystack transactions.
 * Shared across callbacks, webhooks, API checks, and admin manual reconciliation.
 * Idempotent: safe to invoke repeatedly without duplicate side-effects.
 */
export async function processVerifiedPaystackPayment(
  referenceOrId: string,
  options?: {
    source?: 'webhook' | 'callback' | 'api' | 'admin_reconciliation' | 'auto_reconciliation';
    adminUser?: string;
  }
): Promise<{
  success: boolean;
  status: 'success' | 'already_paid' | 'failed' | 'abandoned' | 'mismatch' | 'pending' | 'order_not_found' | 'error';
  order?: Order;
  message?: string;
  error?: string;
  raw?: any;
}> {
  const cleanRef = referenceOrId.trim();
  if (!cleanRef) {
    return {
      success: false,
      status: 'error',
      error: 'Transaction reference is required.',
    };
  }

  // 1. Locate order by Paystack reference, order number, or internal ID
  let order = state.orders.find(
    (o) =>
      o.paystackReference === cleanRef ||
      (o.paystackReference && o.paystackReference.trim().toLowerCase() === cleanRef.toLowerCase()) ||
      o.orderNumber === cleanRef ||
      o.id === cleanRef
  );

  if (!order) {
    return {
      success: false,
      status: 'order_not_found',
      error: `No order found for reference: ${cleanRef}`,
    };
  }

  const paystackRef = order.paystackReference;
  if (!paystackRef) {
    return {
      success: false,
      status: 'error',
      error: `Order ${order.orderNumber} does not have a Paystack reference assigned.`,
      order,
    };
  }

  const sourceLabel = options?.source || 'system';
  console.log(`[Paystack Processor] Initiating verification: Order=${order.orderNumber} | StoredRef=${paystackRef} | Source=${sourceLabel}`);

  // 2. Idempotency Check: if already marked PAID, ensure state integrity and return confirmed
  if (order.paymentStatus === 'PAID') {
    if (order.orderStatus === 'PENDING_PAYMENT') {
      order.orderStatus = 'AWAITING_FULFILLMENT';
      order.updatedAt = new Date().toISOString();
      saveToDisk();
      await setDoc(doc(firestoreDb, 'orders', order.id), order, { merge: true }).catch(() => {});
    }
    console.log(`[Paystack Processor] Order ${order.orderNumber} already marked PAID. (Idempotent response)`);
    return {
      success: true,
      status: 'already_paid',
      order,
      message: `Order ${order.orderNumber} is already confirmed as PAID.`,
    };
  }

  // 3. Authoritative server-side verification using Paystack API and PAYSTACK_SECRET_KEY
  try {
    const verifyResult = await verifyPaystackTransaction(paystackRef, {
      amountGHS: order.amountGHS,
      currency: 'GHS',
    });

    console.log(
      `[Paystack Processor] Verification result for Order=${order.orderNumber}: status=${verifyResult.status} | currency=${verifyResult.currency || 'unknown'} | paidPesewas=${verifyResult.amountPesewas || 0} | expectedPesewas=${Math.round(order.amountGHS * 100)} | channel=${verifyResult.channel || 'n/a'}`
    );

    if (verifyResult.status === 'mismatch') {
      addAuditLog(
        options?.adminUser || 'Paystack Security',
        'PAYMENT_MISMATCH',
        `Fraud verification mismatch on ${paystackRef} for order ${order.orderNumber}: ${verifyResult.errorMessage}`
      );
      return {
        success: false,
        status: 'mismatch',
        error: verifyResult.errorMessage || 'Payment amount or currency mismatch.',
        order,
        raw: verifyResult.raw,
      };
    }

    if (verifyResult.status === 'abandoned') {
      addAuditLog(
        options?.adminUser || 'Paystack Gateway',
        'PAYMENT_ABANDONED',
        `Customer abandoned Paystack checkout for order ${order.orderNumber} (Ref: ${paystackRef}).`
      );
      return {
        success: false,
        status: 'abandoned',
        error: 'Payment was not completed. Checkout was abandoned.',
        order,
        raw: verifyResult.raw,
      };
    }

    if (verifyResult.status === 'failed') {
      addAuditLog(
        options?.adminUser || 'Paystack Gateway',
        'PAYMENT_FAILED',
        `Payment failed for order ${order.orderNumber} (Ref: ${paystackRef}): ${verifyResult.errorMessage || 'Transaction unsuccessful.'}`
      );
      return {
        success: false,
        status: 'failed',
        error: verifyResult.errorMessage || 'Payment transaction failed or was declined.',
        order,
        raw: verifyResult.raw,
      };
    }

    if (verifyResult.status === 'pending') {
      return {
        success: false,
        status: 'pending',
        error: 'Payment transaction is still pending processing with Paystack.',
        order,
        raw: verifyResult.raw,
      };
    }

    if (verifyResult.success && verifyResult.status === 'success') {
      // 4. Verification PASSED: transition order state
      const confirmedOrder = markOrderPaid(paystackRef, verifyResult.channel, verifyResult.raw);
      if (!confirmedOrder) {
        return {
          success: false,
          status: 'error',
          error: 'Failed to update order in database.',
        };
      }

      // Explicitly ensure Firestore is synchronized
      await setDoc(doc(firestoreDb, 'orders', confirmedOrder.id), confirmedOrder, { merge: true }).catch((err) =>
        console.warn('Error syncing reconciled order to Firestore:', err.message)
      );

      const sourceLabel = options?.source || 'system';
      addAuditLog(
        options?.adminUser || 'Paystack Processor',
        'PAYMENT_RECONCILED',
        `Reconciled Paystack payment of GH₵ ${confirmedOrder.amountGHS.toFixed(2)} (Ref: ${paystackRef}, Source: ${sourceLabel}). Order ${confirmedOrder.orderNumber} confirmed PAID and AWAITING_FULFILLMENT.`
      );

      console.log(`[Paystack Processor] Order ${confirmedOrder.orderNumber} verified and confirmed PAID via ${sourceLabel}.`);

      return {
        success: true,
        status: 'success',
        order: confirmedOrder,
        message: `Payment verified successfully! Order ${confirmedOrder.orderNumber} is now PAID and AWAITING FULFILLMENT.`,
        raw: verifyResult.raw,
      };
    }

    return {
      success: false,
      status: 'failed',
      error: verifyResult.errorMessage || 'Paystack transaction could not be verified.',
      order,
      raw: verifyResult.raw,
    };
  } catch (err: any) {
    console.error('[Paystack Processor] Verification error:', err);
    return {
      success: false,
      status: 'error',
      error: err.message || 'Server error communicating with Paystack verification endpoint.',
      order,
    };
  }
}

export function updateOrderStatus(id: string, status: Order['orderStatus'], adminUser: string = 'Admin'): Order | null {
  const order = state.orders.find((o) => o.id === id || o.orderNumber === id);
  if (!order) return null;

  if (order.orderStatus === status) {
    return order;
  }

  const VALID_TRANSITIONS: Record<Order['orderStatus'], Order['orderStatus'][]> = {
    PENDING_PAYMENT: ['PAID', 'AWAITING_FULFILLMENT', 'CANCELLED'],
    PAID: ['AWAITING_FULFILLMENT', 'PROCESSING', 'CANCELLED', 'REFUNDED'],
    AWAITING_FULFILLMENT: ['PROCESSING', 'CANCELLED', 'REFUNDED'],
    PROCESSING: ['FULFILLED', 'DELIVERY_FAILED', 'AWAITING_FULFILLMENT', 'CANCELLED', 'REFUNDED'],
    DELIVERY_FAILED: ['AWAITING_FULFILLMENT', 'PROCESSING', 'FULFILLED', 'CANCELLED', 'REFUNDED'],
    FULFILLED: ['REFUNDED'],
    CANCELLED: [],
    REFUNDED: [],
  };

  const allowed = VALID_TRANSITIONS[order.orderStatus] || [];
  if (!allowed.includes(status)) {
    throw new Error(`Invalid status transition: Cannot move order ${order.orderNumber} from ${order.orderStatus} to ${status}`);
  }

  order.orderStatus = status;
  if ((status === 'PAID' || status === 'AWAITING_FULFILLMENT') && order.paymentStatus === 'PENDING_PAYMENT') {
    order.paymentStatus = 'PAID';
    if (!order.paidAt) {
      order.paidAt = new Date().toISOString();
    }
  }
  order.updatedAt = new Date().toISOString();

  addAuditLog(adminUser, 'ORDER_STATUS_CHANGED', `Changed status of ${order.orderNumber} to "${status}".`);

  // Persist to Firestore
  updateDoc(doc(firestoreDb, 'orders', order.id), {
    orderStatus: status,
    updatedAt: order.updatedAt,
  }).catch((err) => console.warn('Error updating order status in Firestore:', err.message));
  saveToDisk();

  return order;
}

export interface AssignmentEligibilityResult {
  eligible: boolean;
  overridden?: boolean;
  error?: string;
  warning?: string;
  conflictingOrderNumber?: string;
  canOverride?: boolean;
  inventoryItem?: InventoryItem;
  activeCount: number;
  capacity: number;
  usageMode: AccountUsageMode;
}

export function checkAccountAssignmentEligibility(
  accountEmail: string,
  order: Order,
  deliveryInfo?: { accountPassword?: string; backupCodes?: string },
  options?: { allowOverride?: boolean }
): AssignmentEligibilityResult {
  const emailClean = accountEmail.trim().toLowerCase();
  if (!emailClean) {
    return {
      eligible: false,
      error: 'PSN account email is required.',
      activeCount: 0,
      capacity: 1,
      usageMode: 'exclusive',
    };
  }

  // 1. Find existing inventory item if present in pool
  const inventoryItem = state.inventory.find(
    (i) => i.accountEmail && i.accountEmail.trim().toLowerCase() === emailClean
  );

  // Determine usage mode and capacity
  // Defaults based on account type:
  // 'full-private' or 'primary-non-sharing' are exclusive solo accounts
  // 'primary-shared' and 'secondary' are shared accounts
  const isOrderExclusiveType = order.accountTypeId === 'full-private' || order.accountTypeId === 'primary-non-sharing';
  const usageMode: AccountUsageMode = inventoryItem?.usageMode || (isOrderExclusiveType ? 'exclusive' : 'shared');
  const capacity: number = inventoryItem?.maxAssignments ?? (usageMode === 'exclusive' ? 1 : 2);

  // Find all existing orders assigned this account (excluding cancelled/refunded, released, and current order)
  const assignedOrders = state.orders.filter(
    (o) =>
      o.id !== order.id &&
      o.orderStatus !== 'CANCELLED' &&
      o.orderStatus !== 'REFUNDED' &&
      o.deliveryInformation?.accountEmail &&
      !o.deliveryInformation.isReleased &&
      o.deliveryInformation.accountEmail.trim().toLowerCase() === emailClean
  );

  // Also check assignments recorded on the inventory item
  const existingItemAssignments = (inventoryItem?.assignments || []).filter(
    (a) => a.orderId !== order.id && (a.status === 'reserved' || a.status === 'delivered')
  );

  // Combine unique active order references
  const activeOrderIds = new Set<string>();
  assignedOrders.forEach((o) => activeOrderIds.add(o.id));
  existingItemAssignments.forEach((a) => activeOrderIds.add(a.orderId));

  const activeCount = activeOrderIds.size;

  // 2. CHECK RULE: Did any previous assignment treat this account as Full Private or Exclusive?
  for (const assignedOrder of assignedOrders) {
    if (assignedOrder.accountTypeId === 'full-private') {
      const conflictMsg = `Exclusive Account Conflict: Account "${accountEmail}" was already delivered to Order ${assignedOrder.orderNumber} as a Full Private account. Because customers have full private ownership and may change credentials, this PSN account cannot be reassigned or shared.`;
      if (options?.allowOverride) {
        return {
          eligible: true,
          overridden: true,
          warning: conflictMsg,
          conflictingOrderNumber: assignedOrder.orderNumber,
          canOverride: true,
          inventoryItem,
          activeCount,
          capacity,
          usageMode,
        };
      }
      return {
        eligible: false,
        error: conflictMsg,
        conflictingOrderNumber: assignedOrder.orderNumber,
        canOverride: true,
        inventoryItem,
        activeCount,
        capacity,
        usageMode,
      };
    }
    if (assignedOrder.accountTypeId === 'primary-non-sharing' || usageMode === 'exclusive') {
      const conflictMsg = `Exclusive Solo Conflict: Account "${accountEmail}" currently has an exclusive assignment on Order ${assignedOrder.orderNumber} and cannot be used for this order.`;
      if (options?.allowOverride) {
        return {
          eligible: true,
          overridden: true,
          warning: conflictMsg,
          conflictingOrderNumber: assignedOrder.orderNumber,
          canOverride: true,
          inventoryItem,
          activeCount,
          capacity,
          usageMode,
        };
      }
      return {
        eligible: false,
        error: conflictMsg,
        conflictingOrderNumber: assignedOrder.orderNumber,
        canOverride: true,
        inventoryItem,
        activeCount,
        capacity,
        usageMode,
      };
    }
  }

  // 3. CHECK RULE: Is the NEW order being fulfilled an Exclusive or Full Private account?
  if (isOrderExclusiveType || usageMode === 'exclusive') {
    if (activeCount > 0) {
      const existingRef = assignedOrders[0]?.orderNumber || existingItemAssignments[0]?.orderNumber || 'another order';
      const conflictMsg = `Exclusive Assignment Conflict: Order #${order.orderNumber} is for a ${order.accountTypeSnapshot || 'Exclusive'} slot, but account "${accountEmail}" already has ${activeCount} active assignment(s) (including Order ${existingRef}). Exclusive accounts require a dedicated, unshared PSN account.`;
      if (options?.allowOverride) {
        return {
          eligible: true,
          overridden: true,
          warning: conflictMsg,
          conflictingOrderNumber: existingRef,
          canOverride: true,
          inventoryItem,
          activeCount,
          capacity: 1,
          usageMode: 'exclusive',
        };
      }
      return {
        eligible: false,
        error: conflictMsg,
        conflictingOrderNumber: existingRef,
        canOverride: true,
        inventoryItem,
        activeCount,
        capacity: 1,
        usageMode: 'exclusive',
      };
    }
  }

  // 4. CHECK RULE: Shared account capacity limits
  if (usageMode === 'shared') {
    if (activeCount >= capacity) {
      const conflictMsg = `Account Capacity Limit Reached: PSN account "${accountEmail}" has reached its maximum active assignments (${activeCount} / ${capacity}) for this account type.`;
      if (options?.allowOverride) {
        return {
          eligible: true,
          overridden: true,
          warning: conflictMsg,
          canOverride: true,
          inventoryItem,
          activeCount,
          capacity,
          usageMode: 'shared',
        };
      }
      return {
        eligible: false,
        error: conflictMsg,
        canOverride: true,
        inventoryItem,
        activeCount,
        capacity,
        usageMode: 'shared',
      };
    }

    // 5. CHECK RULE: PlayStation Primary Console Slot Compatibility
    // A single PSN account can only be activated as Primary on ONE PS5 and ONE PS4 console simultaneously.
    if (order.accountTypeId === 'primary-shared') {
      const sameConsolePrimaryConflict = assignedOrders.find(
        (o) => o.console === order.console && o.accountTypeId === 'primary-shared'
      );
      if (sameConsolePrimaryConflict) {
        const conflictMsg = `Primary Console Slot Conflict: Account "${accountEmail}" already has an active Primary activation for ${order.console} on Order ${sameConsolePrimaryConflict.orderNumber}. A PSN account can only have one Primary activation per console platform.`;
        if (options?.allowOverride) {
          return {
            eligible: true,
            overridden: true,
            warning: conflictMsg,
            conflictingOrderNumber: sameConsolePrimaryConflict.orderNumber,
            canOverride: true,
            inventoryItem,
            activeCount,
            capacity,
            usageMode: 'shared',
          };
        }
        return {
          eligible: false,
          error: conflictMsg,
          conflictingOrderNumber: sameConsolePrimaryConflict.orderNumber,
          canOverride: true,
          inventoryItem,
          activeCount,
          capacity,
          usageMode: 'shared',
        };
      }
    }
  }

  return {
    eligible: true,
    inventoryItem,
    activeCount,
    capacity,
    usageMode,
  };
}

export function reserveAccountForOrder(
  orderId: string,
  deliveryInfo: {
    accountEmail: string;
    accountPassword: string;
    setupInstructions?: string;
    backupCodes?: string;
    notes?: string;
  },
  adminUser: string = 'Admin',
  allowOverride: boolean = false
): { order: Order; inventoryItem: InventoryItem } {
  const order = state.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  // Invariant 1: Payment must be PAID
  if (order.paymentStatus !== 'PAID') {
    throw new Error(`Cannot fulfill order ${order.orderNumber}: Payment status is ${order.paymentStatus}`);
  }

  // Invariant 2: Order must be eligible for fulfillment
  if (order.orderStatus === 'CANCELLED' || order.orderStatus === 'REFUNDED') {
    throw new Error(`Cannot fulfill order ${order.orderNumber}: Order is ${order.orderStatus}`);
  }

  // Invariant 3: Validate credentials
  if (!deliveryInfo.accountEmail?.trim() || !deliveryInfo.accountPassword?.trim()) {
    throw new Error('Account email and password are required for fulfillment');
  }

  const emailClean = deliveryInfo.accountEmail.trim().toLowerCase();

  // Run authoritative eligibility check (with optional admin override)
  const eligibility = checkAccountAssignmentEligibility(deliveryInfo.accountEmail, order, deliveryInfo, { allowOverride });
  if (!eligibility.eligible) {
    throw new Error(eligibility.error || 'Account is not eligible for assignment to this order.');
  }

  if (eligibility.overridden) {
    addAuditLog(
      adminUser,
      'ASSIGNMENT_OVERRIDDEN',
      `Admin override authorized for account ${emailClean} on order ${order.orderNumber}. Note: ${eligibility.warning || 'Admin credential reset confirmed'}`
    );
  }

  let invItem = state.inventory.find(
    (i) => i.accountEmail && i.accountEmail.trim().toLowerCase() === emailClean
  );

  const now = new Date().toISOString();
  const assignmentId = `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const newAssignment: InventoryAssignment = {
    id: assignmentId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerEmail: order.customerEmail,
    console: order.console,
    accountTypeId: order.accountTypeId,
    status: 'reserved',
    assignedAt: now,
    assignedBy: adminUser,
  };

  if (!invItem) {
    const invId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    invItem = {
      id: invId,
      gameId: order.gameId,
      console: order.console,
      accountTypeId: order.accountTypeId,
      accountEmail: deliveryInfo.accountEmail.trim(),
      accountPassword: deliveryInfo.accountPassword.trim(),
      backupCodes: deliveryInfo.backupCodes?.trim() || '',
      additionalNotes: deliveryInfo.notes?.trim() || '',
      usageMode: eligibility.usageMode,
      maxAssignments: eligibility.capacity,
      status: 'reserved',
      assignedOrderId: order.id,
      assignments: [newAssignment],
      createdAt: now,
      updatedAt: now,
    };
    state.inventory.push(invItem);
  } else {
    invItem.accountPassword = deliveryInfo.accountPassword.trim();
    if (deliveryInfo.backupCodes) invItem.backupCodes = deliveryInfo.backupCodes.trim();
    if (!invItem.assignments) invItem.assignments = [];

    // Remove any previous uncompleted assignment for this specific order
    invItem.assignments = invItem.assignments.filter((a) => a.orderId !== order.id);
    invItem.assignments.push(newAssignment);
    invItem.status = 'reserved';
    invItem.assignedOrderId = order.id;
    invItem.updatedAt = now;
  }

  // Update order to in-progress reservation state
  order.orderStatus = 'PROCESSING';
  order.deliveryEmailStatus = 'SENDING';
  order.deliveryInformation = {
    accountEmail: deliveryInfo.accountEmail.trim(),
    accountPassword: deliveryInfo.accountPassword.trim(),
    setupInstructions: deliveryInfo.setupInstructions?.trim() || 'Please refer to your account type instructions.',
    backupCodes: deliveryInfo.backupCodes?.trim() || '',
    notes: deliveryInfo.notes?.trim() || '',
    fulfilledAt: now,
    fulfilledBy: adminUser,
    deliveryEmailStatus: 'SENDING',
    deliveryEmailAttempts: (order.deliveryEmailAttempts || 0) + 1,
  };
  order.updatedAt = now;

  addAuditLog(
    adminUser,
    'ASSIGNMENT_RESERVED',
    `Reserved PSN account for order ${order.orderNumber} (Mode: ${invItem.usageMode}, Capacity: ${invItem.maxAssignments || 1})`
  );

  setDoc(doc(firestoreDb, 'inventory', invItem.id), invItem, { merge: true }).catch(() => {});
  setDoc(doc(firestoreDb, 'orders', order.id), order, { merge: true }).catch(() => {});
  saveToDisk();

  return { order, inventoryItem: invItem };
}

export function releaseOrderAccount(orderId: string, adminUser: string = 'Admin'): Order {
  const order = state.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }
  if (!order.deliveryInformation?.accountEmail) {
    throw new Error(`Order ${order.orderNumber} does not have an assigned PSN account to release.`);
  }

  const releasedAccount = order.deliveryInformation.accountEmail;
  order.deliveryInformation.isReleased = true;
  order.deliveryInformation.releasedAt = new Date().toISOString();
  order.deliveryInformation.releasedBy = adminUser;
  order.updatedAt = new Date().toISOString();

  // If inventory items hold assignments for this order, clean them up
  const cleanEmail = releasedAccount.trim().toLowerCase();
  for (const inv of state.inventory) {
    if (inv.accountEmail && inv.accountEmail.trim().toLowerCase() === cleanEmail) {
      if (inv.assignments) {
        inv.assignments = inv.assignments.filter((a) => a.orderId !== order.id);
      }
      if (inv.assignedOrderId === order.id) {
        delete inv.assignedOrderId;
      }
      inv.status = (inv.assignments?.length || 0) >= (inv.maxAssignments || 1) ? 'delivered' : 'available';
      inv.updatedAt = new Date().toISOString();
      setDoc(doc(firestoreDb, 'inventory', inv.id), inv, { merge: true }).catch(() => {});
    }
  }

  addAuditLog(
    adminUser,
    'ASSIGNMENT_RELEASED',
    `Released PSN account (${releasedAccount}) from order ${order.orderNumber}. Account is now unblocked and available for reassignment.`
  );

  setDoc(doc(firestoreDb, 'orders', order.id), order, { merge: true }).catch(() => {});
  saveToDisk();

  return order;
}

export function finalizeOrderFulfillment(
  orderId: string,
  deliveryInfo: {
    accountEmail: string;
    accountPassword: string;
    setupInstructions?: string;
    backupCodes?: string;
    notes?: string;
  },
  adminUser: string = 'Admin',
  emailDeliveryMetadata?: {
    status?: DeliveryEmailStatus;
    provider?: string;
    error?: string;
    messageId?: string;
    sentAt?: string;
  }
): Order {
  const order = state.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  const now = new Date().toISOString();
  const emailStatus = emailDeliveryMetadata?.status || 'ACCEPTED';
  const emailSentAt = emailDeliveryMetadata?.sentAt || now;
  const isAcceptedOrSent = emailStatus === 'SENT' || emailStatus === 'ACCEPTED' || emailStatus === 'DELIVERED';

  order.orderStatus = 'FULFILLED';
  order.updatedAt = now;
  order.deliveryEmailStatus = emailStatus;
  if (isAcceptedOrSent) {
    order.deliveryEmailSentAt = emailSentAt;
  } else {
    delete order.deliveryEmailSentAt;
  }
  if (emailDeliveryMetadata?.provider) {
    order.deliveryEmailProvider = emailDeliveryMetadata.provider;
  } else {
    delete order.deliveryEmailProvider;
  }
  if (emailDeliveryMetadata?.error) {
    order.deliveryEmailError = emailDeliveryMetadata.error;
  } else {
    delete order.deliveryEmailError;
  }
  if (emailDeliveryMetadata?.messageId) {
    order.deliveryEmailMessageId = emailDeliveryMetadata.messageId;
  } else {
    delete order.deliveryEmailMessageId;
  }

  if (order.deliveryInformation) {
    order.deliveryInformation.deliveryEmailStatus = emailStatus;
    if (isAcceptedOrSent) {
      order.deliveryInformation.deliveryEmailSentAt = emailSentAt;
    } else {
      delete order.deliveryInformation.deliveryEmailSentAt;
    }
    if (emailDeliveryMetadata?.provider) {
      order.deliveryInformation.deliveryEmailProvider = emailDeliveryMetadata.provider;
    } else {
      delete order.deliveryInformation.deliveryEmailProvider;
    }
    if (emailDeliveryMetadata?.error) {
      order.deliveryInformation.deliveryEmailError = emailDeliveryMetadata.error;
    } else {
      delete order.deliveryInformation.deliveryEmailError;
    }
    if (emailDeliveryMetadata?.messageId) {
      order.deliveryInformation.deliveryEmailMessageId = emailDeliveryMetadata.messageId;
    } else {
      delete order.deliveryInformation.deliveryEmailMessageId;
    }
    order.deliveryInformation.fulfilledAt = now;
    order.deliveryInformation.fulfilledBy = adminUser;
  }

  const emailClean = deliveryInfo.accountEmail.trim().toLowerCase();
  const invItem = state.inventory.find(
    (i) =>
      i.assignedOrderId === order.id ||
      (i.accountEmail && i.accountEmail.trim().toLowerCase() === emailClean)
  );

  if (invItem) {
    if (invItem.assignments) {
      const asgn = invItem.assignments.find((a) => a.orderId === order.id);
      if (asgn) {
        asgn.status = 'delivered';
        asgn.deliveredAt = now;
      }
    }
    const activeAssignments = (invItem.assignments || []).filter(
      (a) => a.status === 'reserved' || a.status === 'delivered'
    );
    const capacity = invItem.maxAssignments || (invItem.usageMode === 'exclusive' ? 1 : 2);
    invItem.status = activeAssignments.length >= capacity ? 'delivered' : 'available';
    invItem.updatedAt = now;

    setDoc(doc(firestoreDb, 'inventory', invItem.id), invItem, { merge: true }).catch(() => {});
  }

  addNotification(
    'ORDER_FULFILLED',
    `Order Fulfilled - ${order.orderNumber}`,
    `Order ${order.orderNumber} for ${order.gameTitleSnapshot} (${order.console}) was fulfilled and credentials delivered to ${order.customerEmail}.`,
    order.id,
    order.orderNumber
  );

  addAuditLog(
    adminUser,
    'ORDER_FULFILLED',
    `Fulfilled order ${order.orderNumber} with delivery credentials dispatched to ${order.customerEmail}`
  );

  setDoc(doc(firestoreDb, 'orders', order.id), order, { merge: true }).catch(() => {});
  saveToDisk();

  return order;
}

export function handleFulfillmentEmailFailure(
  orderId: string,
  emailResult: { provider?: string; error?: string },
  adminUser: string = 'Admin'
): Order {
  const order = state.orders.find((o) => o.id === orderId || o.orderNumber === orderId);
  if (!order) {
    throw new Error('Order not found');
  }

  const now = new Date().toISOString();
  order.orderStatus = 'DELIVERY_FAILED';
  order.deliveryEmailStatus = 'FAILED';
  order.deliveryEmailError = emailResult.error || 'Failed to dispatch customer delivery email';
  if (emailResult.provider) {
    order.deliveryEmailProvider = emailResult.provider;
  } else {
    delete order.deliveryEmailProvider;
  }
  order.updatedAt = now;

  if (order.deliveryInformation) {
    order.deliveryInformation.deliveryEmailStatus = 'FAILED';
    order.deliveryInformation.deliveryEmailError = emailResult.error || 'Failed to dispatch customer delivery email';
    if (emailResult.provider) {
      order.deliveryInformation.deliveryEmailProvider = emailResult.provider;
    } else {
      delete order.deliveryInformation.deliveryEmailProvider;
    }
  }

  // Important: The inventory item reservation remains locked to this order!
  // It is NOT unassigned or given to anyone else.

  addAuditLog(
    adminUser,
    'DELIVERY_EMAIL_FAILED',
    `Customer delivery email failed for order ${order.orderNumber} (${emailResult.error || 'Email error'}). Inventory assignment preserved for retry.`
  );

  setDoc(doc(firestoreDb, 'orders', order.id), order, { merge: true }).catch(() => {});
  saveToDisk();

  return order;
}

export function fulfillOrder(
  id: string,
  deliveryInfo: {
    accountEmail: string;
    accountPassword: string;
    setupInstructions?: string;
    backupCodes?: string;
    notes?: string;
  },
  adminUser: string = 'Admin',
  emailDeliveryMetadata?: {
    status: 'SENT' | 'FAILED' | 'PENDING';
    provider?: string;
    messageId?: string;
    error?: string;
    sentAt?: string;
  }
): Order | null {
  const order = state.orders.find((o) => o.id === id || o.orderNumber === id);
  if (!order) return null;

  // Duplicate fulfillment protection (idempotency)
  if (order.orderStatus === 'FULFILLED' && emailDeliveryMetadata?.status === 'SENT') {
    return order;
  }

  // 1. Atomically reserve first (validates payment, eligibility, capacity, and credentials)
  reserveAccountForOrder(order.id, deliveryInfo, adminUser);

  // 2. Finalize or record failure based on metadata
  if (emailDeliveryMetadata?.status === 'SENT') {
    return finalizeOrderFulfillment(order.id, deliveryInfo, adminUser, emailDeliveryMetadata);
  } else if (emailDeliveryMetadata?.status === 'FAILED') {
    return handleFulfillmentEmailFailure(
      order.id,
      { provider: emailDeliveryMetadata.provider, error: emailDeliveryMetadata.error },
      adminUser
    );
  }

  return order;
}

export function updateOrderDeliveryEmailStatus(
  id: string,
  status: DeliveryEmailStatus,
  metadata?: {
    provider?: string;
    messageId?: string;
    error?: string;
    sentAt?: string;
  },
  adminUser: string = 'Admin'
): Order | null {
  const order = state.orders.find((o) => o.id === id || o.orderNumber === id);
  if (!order) return null;

  const isAcceptedOrSent = status === 'SENT' || status === 'ACCEPTED' || status === 'DELIVERED';

  order.deliveryEmailStatus = status;
  order.deliveryEmailAttempts = (order.deliveryEmailAttempts || 0) + 1;
  if (isAcceptedOrSent) {
    order.deliveryEmailSentAt = metadata?.sentAt || new Date().toISOString();
    delete order.deliveryEmailError;
  } else {
    if (metadata?.error) {
      order.deliveryEmailError = metadata.error;
    } else {
      delete order.deliveryEmailError;
    }
  }
  if (metadata?.provider) {
    order.deliveryEmailProvider = metadata.provider;
  } else {
    delete order.deliveryEmailProvider;
  }
  if (metadata?.messageId) {
    order.deliveryEmailMessageId = metadata.messageId;
  } else {
    delete order.deliveryEmailMessageId;
  }
  order.updatedAt = new Date().toISOString();

  if (order.deliveryInformation) {
    order.deliveryInformation.deliveryEmailStatus = status;
    if (order.deliveryEmailSentAt) {
      order.deliveryInformation.deliveryEmailSentAt = order.deliveryEmailSentAt;
    } else {
      delete order.deliveryInformation.deliveryEmailSentAt;
    }
    order.deliveryInformation.deliveryEmailAttempts = order.deliveryEmailAttempts;
    if (order.deliveryEmailProvider) {
      order.deliveryInformation.deliveryEmailProvider = order.deliveryEmailProvider;
    } else {
      delete order.deliveryInformation.deliveryEmailProvider;
    }
    if (order.deliveryEmailError) {
      order.deliveryInformation.deliveryEmailError = order.deliveryEmailError;
    } else {
      delete order.deliveryInformation.deliveryEmailError;
    }
    if (order.deliveryEmailMessageId) {
      order.deliveryInformation.deliveryEmailMessageId = order.deliveryEmailMessageId;
    } else {
      delete order.deliveryInformation.deliveryEmailMessageId;
    }
  }

  addAuditLog(adminUser, 'DELIVERY_EMAIL_UPDATED', `Updated delivery email status for ${order.orderNumber} to ${status}.`);

  updateDoc(doc(firestoreDb, 'orders', order.id), {
    deliveryEmailStatus: order.deliveryEmailStatus,
    deliveryEmailSentAt: order.deliveryEmailSentAt || null,
    deliveryEmailAttempts: order.deliveryEmailAttempts,
    deliveryEmailProvider: order.deliveryEmailProvider || null,
    deliveryEmailError: order.deliveryEmailError || null,
    deliveryEmailMessageId: order.deliveryEmailMessageId || null,
    deliveryInformation: order.deliveryInformation || null,
    updatedAt: order.updatedAt,
  }).catch((err) => console.warn('Error updating delivery email in Firestore:', err.message));
  saveToDisk();

  return order;
}

// ---------------- FAQs ----------------

export function getFAQs(): FAQItem[] {
  return state.faqs;
}

export function createFAQ(faqData: Omit<FAQItem, 'id'>, adminUser: string = 'Admin'): FAQItem {
  const id = `faq_${Date.now()}`;
  const newFaq: FAQItem = { ...faqData, id };
  state.faqs.push(newFaq);

  addAuditLog(adminUser, 'FAQ_CREATED', `Added new FAQ question: "${newFaq.question}"`);

  setDoc(doc(firestoreDb, 'faqs', id), newFaq).catch((err) =>
    console.warn('Error creating FAQ in Firestore:', err.message)
  );

  return newFaq;
}

export function updateFAQ(id: string, updates: Partial<FAQItem>, adminUser: string = 'Admin'): FAQItem | null {
  const index = state.faqs.findIndex((f) => f.id === id);
  if (index === -1) return null;

  const updated = { ...state.faqs[index], ...updates };
  state.faqs[index] = updated;

  addAuditLog(adminUser, 'FAQ_UPDATED', `Updated FAQ question: "${updated.question}"`);

  setDoc(doc(firestoreDb, 'faqs', id), updated, { merge: true }).catch((err) =>
    console.warn('Error updating FAQ in Firestore:', err.message)
  );

  return updated;
}

export function deleteFAQ(id: string, adminUser: string = 'Admin'): boolean {
  const index = state.faqs.findIndex((f) => f.id === id);
  if (index === -1) return false;

  state.faqs.splice(index, 1);
  addAuditLog(adminUser, 'FAQ_DELETED', `Deleted FAQ (ID: ${id})`);

  deleteDoc(doc(firestoreDb, 'faqs', id)).catch((err) =>
    console.warn('Error deleting FAQ from Firestore:', err.message)
  );

  return true;
}

// ---------------- Inventory ----------------

export function getInventory(): InventoryItem[] {
  return state.inventory;
}

export function addInventoryItem(itemData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>, adminUser: string = 'Admin'): InventoryItem {
  const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const isExclusiveType = itemData.accountTypeId === 'full-private' || itemData.accountTypeId === 'primary-non-sharing';
  const usageMode: AccountUsageMode = itemData.usageMode || (isExclusiveType ? 'exclusive' : 'shared');
  const maxAssignments = itemData.maxAssignments ?? (usageMode === 'exclusive' ? 1 : 2);

  const newItem: InventoryItem = {
    ...itemData,
    id,
    usageMode,
    maxAssignments,
    assignments: itemData.assignments || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.inventory.push(newItem);
  addAuditLog(adminUser, 'INVENTORY_ADDED', `Added inventory account pool item for game ID: ${newItem.gameId} (Mode: ${usageMode}, Max: ${maxAssignments})`);

  setDoc(doc(firestoreDb, 'inventory', id), newItem).catch((err) =>
    console.warn('Error adding inventory in Firestore:', err.message)
  );
  saveToDisk();

  return newItem;
}

export function updateInventoryItem(id: string, updates: Partial<InventoryItem>, adminUser: string = 'Admin'): InventoryItem | null {
  const index = state.inventory.findIndex((i) => i.id === id);
  if (index === -1) return null;

  // If updates change usageMode or maxAssignments, maintain consistency
  if (updates.usageMode === 'exclusive' && updates.maxAssignments === undefined) {
    updates.maxAssignments = 1;
  }

  const updated = { ...state.inventory[index], ...updates, updatedAt: new Date().toISOString() };
  state.inventory[index] = updated;

  addAuditLog(adminUser, 'INVENTORY_UPDATED', `Updated inventory account pool (ID: ${id})`);

  setDoc(doc(firestoreDb, 'inventory', id), updated, { merge: true }).catch((err) =>
    console.warn('Error updating inventory in Firestore:', err.message)
  );
  saveToDisk();

  return updated;
}

export function deleteInventoryItem(id: string, adminUser: string = 'Admin'): boolean {
  const index = state.inventory.findIndex((i) => i.id === id);
  if (index === -1) return false;

  state.inventory.splice(index, 1);
  addAuditLog(adminUser, 'INVENTORY_DELETED', `Deleted inventory account pool item (ID: ${id})`);

  deleteDoc(doc(firestoreDb, 'inventory', id)).catch((err) =>
    console.warn('Error deleting inventory item from Firestore:', err.message)
  );
  saveToDisk();

  return true;
}

// ---------------- Audit Logs & Notifications ----------------

export function getAuditLogs(): AuditLog[] {
  return [...state.auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function addAuditLog(adminUser: string, action: string, details: string): AuditLog {
  // Defensive credential masking: never store raw passwords or sensitive keys in audit logs
  const safeDetails = details.replace(
    /(password|secret|passcode|backup\s*code|credential)[\s:=]+([^\s,;]+)/gi,
    '$1: [REDACTED]'
  );

  const log: AuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    adminUser,
    action,
    details: safeDetails,
    timestamp: new Date().toISOString(),
  };

  state.auditLogs.unshift(log);
  if (state.auditLogs.length > 500) state.auditLogs.pop();

  const firestoreLog = {
    id: log.id,
    adminUser: log.adminUser,
    action: log.action,
    details: log.details,
    timestamp: log.timestamp,
  };

  setDoc(doc(firestoreDb, 'auditLogs', log.id), firestoreLog).catch((err) =>
    console.warn('Error writing audit log to Firestore:', err.message)
  );
  saveToDisk();

  return log;
}

export function getNotifications(): AdminNotification[] {
  return [...state.notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function addNotification(
  type: AdminNotification['type'],
  title: string,
  message: string,
  orderId?: string,
  orderNumber?: string
): AdminNotification {
  const notif: AdminNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    type,
    title,
    message,
    orderId: orderId || undefined,
    orderNumber: orderNumber || undefined,
    read: false,
    createdAt: new Date().toISOString(),
  };

  state.notifications.unshift(notif);
  if (state.notifications.length > 100) state.notifications.pop();

  const firestoreNotif: any = {
    id: notif.id,
    type: notif.type,
    title: notif.title,
    message: notif.message,
    read: notif.read,
    createdAt: notif.createdAt,
  };
  if (orderId) firestoreNotif.orderId = orderId;
  if (orderNumber) firestoreNotif.orderNumber = orderNumber;

  setDoc(doc(firestoreDb, 'notifications', notif.id), firestoreNotif).catch((err) =>
    console.warn('Error writing notification to Firestore:', err.message)
  );

  return notif;
}

export function markNotificationRead(id: string): boolean {
  const notif = state.notifications.find((n) => n.id === id);
  if (!notif) return false;
  notif.read = true;

  updateDoc(doc(firestoreDb, 'notifications', id), { read: true }).catch((err) =>
    console.warn('Error updating notification in Firestore:', err.message)
  );

  saveToDisk();
  return true;
}

export function markAllNotificationsRead(): boolean {
  for (const notif of state.notifications) {
    notif.read = true;
  }
  saveToDisk();
  return true;
}

// ---------------- Real Analytics (NO FAKE DATA) ----------------

export function getAnalytics() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;

  const orders = state.orders;
  const paidOrders = orders.filter((o) => o.paymentStatus === 'PAID');

  const todayOrders = paidOrders.filter((o) => new Date(o.createdAt).getTime() >= todayStart);
  const weekOrders = paidOrders.filter((o) => new Date(o.createdAt).getTime() >= weekStart);

  const todayRevenueGHS = todayOrders.reduce((sum, o) => sum + o.amountGHS, 0);
  const todayCatalogUSD = todayOrders.reduce((sum, o) => sum + o.priceUSD, 0);

  const weekRevenueGHS = weekOrders.reduce((sum, o) => sum + o.amountGHS, 0);
  const weekCatalogUSD = weekOrders.reduce((sum, o) => sum + o.priceUSD, 0);

  const lifetimeRevenueGHS = paidOrders.reduce((sum, o) => sum + o.amountGHS, 0);
  const lifetimeCatalogUSD = paidOrders.reduce((sum, o) => sum + o.priceUSD, 0);

  const awaitingFulfillment = orders.filter((o) => o.orderStatus === 'AWAITING_FULFILLMENT').length;
  const processing = orders.filter((o) => o.orderStatus === 'PROCESSING').length;
  const fulfilled = orders.filter((o) => o.orderStatus === 'FULFILLED').length;
  const cancelled = orders.filter((o) => o.orderStatus === 'CANCELLED').length;
  const refunded = orders.filter((o) => o.orderStatus === 'REFUNDED').length;
  const pendingPayment = orders.filter((o) => o.orderStatus === 'PENDING_PAYMENT').length;

  const totalInventory = state.inventory.length;
  const availableInventory = state.inventory.filter((i) => i.status === 'available').length;
  const reservedInventory = state.inventory.filter((i) => i.status === 'reserved').length;
  const deliveredInventory = state.inventory.filter((i) => i.status === 'delivered').length;

  return {
    today: {
      revenueGHS: todayRevenueGHS,
      catalogUSD: todayCatalogUSD,
      ordersCount: todayOrders.length,
    },
    week: {
      revenueGHS: weekRevenueGHS,
      catalogUSD: weekCatalogUSD,
      ordersCount: weekOrders.length,
    },
    lifetime: {
      totalRevenueGHS: lifetimeRevenueGHS,
      totalCatalogUSD: lifetimeCatalogUSD,
      ordersCount: paidOrders.length,
    },
    statusCounts: {
      awaitingFulfillment,
      processing,
      fulfilled,
      cancelled,
      refunded,
      pendingPayment,
    },
    inventory: {
      total: totalInventory,
      available: availableInventory,
      reserved: reservedInventory,
      delivered: deliveredInventory,
      lowStock: availableInventory < 3,
    },
    totalRevenueGHS: lifetimeRevenueGHS,
    totalRevenueUSD: lifetimeCatalogUSD,
    totalOrdersCount: orders.length,
    paidOrdersCount: paidOrders.length,
    fulfilledCount: fulfilled,
    pendingFulfillmentCount: awaitingFulfillment,
    activeGamesCount: state.games.filter((g) => g.isActive).length,
    currentExchangeRate: state.settings.exchangeRateUSDToGHS,
  };
}
