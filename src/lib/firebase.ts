import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc as rawSetDoc,
  addDoc,
  updateDoc as rawUpdateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
  setLogLevel,
} from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Game, SiteSettings, AccountTypeConfig, Order, FAQItem, InventoryItem, AuditLog, AdminNotification } from '../types';

// Silence benign internal gRPC idle stream disconnection messages
setLogLevel('silent');

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

export function setDoc(docRef: any, data: any, options?: { merge?: boolean }): Promise<void> {
  try {
    purgeUndefinedValues(data);
    const cleaned = cleanFirestoreData(data);
    const p = options ? rawSetDoc(docRef, cleaned, options) : rawSetDoc(docRef, cleaned);
    return p.catch((err) => {
      console.warn(`[Client Firestore setDoc] Note on ${docRef?.path || 'doc'}:`, err.message);
    });
  } catch (err: any) {
    console.warn(`[Client Firestore setDoc] Sync note on ${docRef?.path || 'doc'}:`, err.message);
    return Promise.resolve();
  }
}

export function updateDoc(docRef: any, data: any): Promise<void> {
  try {
    purgeUndefinedValues(data);
    const cleaned = cleanFirestoreData(data);
    const p = rawUpdateDoc(docRef, cleaned);
    return p.catch((err) => {
      console.warn(`[Client Firestore updateDoc] Note on ${docRef?.path || 'doc'}:`, err.message);
    });
  } catch (err: any) {
    console.warn(`[Client Firestore updateDoc] Sync note on ${docRef?.path || 'doc'}:`, err.message);
    return Promise.resolve();
  }
}

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogleAccount(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

export async function getCurrentUserIdToken(forceRefresh: boolean = false): Promise<string | null> {
  if (!auth.currentUser) return null;
  return await auth.currentUser.getIdToken(forceRefresh);
}

export const ADMIN_EMAIL = (import.meta as any).env?.VITE_ADMIN_EMAIL || '';

export function isUserAdmin(user: User | null): boolean {
  if (!user || !user.email) return false;
  const configuredAdminEmail = ADMIN_EMAIL ? ADMIN_EMAIL.trim().toLowerCase() : '';
  if (configuredAdminEmail) {
    return user.email.toLowerCase() === configuredAdminEmail;
  }
  return false;
}

// ---------------- Realtime Listeners ----------------

export function subscribeToSiteSettings(callback: (settings: SiteSettings | null) => void): Unsubscribe {
  const docRef = doc(db, 'siteSettings', 'config');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as SiteSettings);
    } else {
      callback(null);
    }
  }, (err) => {
    console.warn('Firestore siteSettings listener warning:', err.message);
  });
}

export function subscribeToGames(callback: (games: Game[]) => void, adminMode: boolean = false): Unsubscribe {
  const gamesCol = collection(db, 'games');
  const q = adminMode
    ? query(gamesCol, orderBy('sortOrder', 'asc'))
    : query(gamesCol, where('isActive', '==', true));

  return onSnapshot(q, (snapshot) => {
    const list: Game[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...(docSnap.data() as any) } as Game);
    });
    // Sort in memory if needed
    list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const finalList = adminMode ? list : list.filter((g) => g.isActive && !g.isArchived);
    callback(finalList);
  }, (err) => {
    console.warn('Firestore games listener warning:', err.message);
    callback([]);
  });
}

export function subscribeToAccountTypes(callback: (types: AccountTypeConfig[]) => void, adminMode: boolean = false): Unsubscribe {
  const col = collection(db, 'accountTypes');
  const q = adminMode ? col : query(col, where('isActive', '==', true));

  return onSnapshot(q, (snapshot) => {
    const list: AccountTypeConfig[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...(docSnap.data() as any) } as AccountTypeConfig);
    });
    list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    callback(list);
  }, (err) => {
    console.warn('Firestore accountTypes listener warning:', err.message);
  });
}

export function subscribeToFAQs(callback: (faqs: FAQItem[]) => void, adminMode: boolean = false): Unsubscribe {
  const col = collection(db, 'faqs');
  const q = adminMode ? col : query(col, where('isActive', '==', true));

  return onSnapshot(q, (snapshot) => {
    const list: FAQItem[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...(docSnap.data() as any) } as FAQItem);
    });
    list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    callback(list);
  }, (err) => {
    console.warn('Firestore faqs listener warning:', err.message);
  });
}

export function subscribeToOrders(callback: (orders: Order[]) => void): Unsubscribe {
  const col = collection(db, 'orders');
  return onSnapshot(col, (snapshot) => {
    const list: Order[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...(docSnap.data() as any) } as Order);
    });
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(list);
  }, (err) => {
    console.warn('Firestore orders listener warning (admin only):', err.message);
  });
}

export function subscribeToInventory(callback: (items: InventoryItem[]) => void): Unsubscribe {
  const col = collection(db, 'inventory');
  return onSnapshot(col, (snapshot) => {
    const list: InventoryItem[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...(docSnap.data() as any) } as InventoryItem);
    });
    callback(list);
  }, (err) => {
    console.warn('Firestore inventory listener warning:', err.message);
  });
}

export function subscribeToAuditLogs(callback: (logs: AuditLog[]) => void): Unsubscribe {
  const col = collection(db, 'auditLogs');
  return onSnapshot(col, (snapshot) => {
    const list: AuditLog[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...(docSnap.data() as any) } as AuditLog);
    });
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    callback(list);
  }, (err) => {
    console.warn('Firestore auditLogs listener warning:', err.message);
  });
}

export function subscribeToNotifications(callback: (notifs: AdminNotification[]) => void): Unsubscribe {
  const col = collection(db, 'notifications');
  return onSnapshot(col, (snapshot) => {
    const list: AdminNotification[] = [];
    snapshot.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...(docSnap.data() as any) } as AdminNotification);
    });
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(list);
  }, (err) => {
    console.warn('Firestore notifications listener warning:', err.message);
  });
}

// ---------------- Admin Mutations ----------------

export async function saveSiteSettingsToFirestore(settings: SiteSettings): Promise<void> {
  await setDoc(doc(db, 'siteSettings', 'config'), {
    ...settings,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

export async function saveGameToFirestore(game: Game): Promise<string> {
  const gameId = game.id || `game_${Date.now()}`;
  await setDoc(doc(db, 'games', gameId), {
    ...game,
    id: gameId,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return gameId;
}

export async function deleteGameFromFirestore(gameId: string): Promise<void> {
  await deleteDoc(doc(db, 'games', gameId));
}

export async function saveAccountTypeToFirestore(accountType: AccountTypeConfig): Promise<void> {
  await setDoc(doc(db, 'accountTypes', accountType.id), {
    ...accountType,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

export async function deleteAccountTypeFromFirestore(typeId: string): Promise<void> {
  await deleteDoc(doc(db, 'accountTypes', typeId));
}

export async function saveFAQToFirestore(faq: FAQItem): Promise<string> {
  const faqId = faq.id || `faq_${Date.now()}`;
  await setDoc(doc(db, 'faqs', faqId), {
    ...faq,
    id: faqId,
  }, { merge: true });
  return faqId;
}

export async function deleteFAQFromFirestore(faqId: string): Promise<void> {
  await deleteDoc(doc(db, 'faqs', faqId));
}

export async function saveInventoryItemToFirestore(item: InventoryItem): Promise<string> {
  const itemId = item.id || `inv_${Date.now()}`;
  await setDoc(doc(db, 'inventory', itemId), {
    ...item,
    id: itemId,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return itemId;
}

export async function deleteInventoryItemFromFirestore(itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'inventory', itemId));
}

export async function updateOrderInFirestore(orderId: string, updates: Partial<Order>): Promise<void> {
  await updateDoc(doc(db, 'orders', orderId), {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

export async function addAuditLogToFirestore(adminUser: string, action: string, details: string): Promise<void> {
  try {
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await setDoc(doc(db, 'auditLogs', id), {
      id,
      adminUser,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to add audit log:', err);
  }
}

export async function addNotificationToFirestore(
  type: 'NEW_ORDER' | 'PAYMENT_SUCCESS' | 'ORDER_FULFILLED' | 'LOW_INVENTORY',
  title: string,
  message: string,
  orderId?: string
): Promise<void> {
  try {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await setDoc(doc(db, 'notifications', id), {
      id,
      type,
      title,
      message,
      orderId: orderId || null,
      read: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to add notification:', err);
  }
}
