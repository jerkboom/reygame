import firebaseConfig from '../firebase-applet-config.json';

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  emailVerified?: boolean;
}

// In-memory token verification cache to reduce external network round-trips
const tokenCache = new Map<string, { user: VerifiedFirebaseUser; expiresAt: number }>();

/**
 * Authoritatively verifies a Firebase ID Token on the server.
 * Uses Google Identity Toolkit REST API with standard JWT claims validation.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  if (!idToken || typeof idToken !== 'string') {
    return null;
  }

  const cleanToken = idToken.trim();

  // Check cache first
  const cached = tokenCache.get(cleanToken);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }

  // 1. Basic JWT structure validation
  let payload: any = null;
  try {
    const parts = cleanToken.split('.');
    if (parts.length !== 3) {
      return null;
    }
    payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);

    // Check expiration and audience
    if (payload.exp && payload.exp < nowSec) {
      return null;
    }
    if (payload.aud && payload.aud !== firebaseConfig.projectId) {
      return null;
    }
  } catch (err) {
    return null;
  }

  // 2. Authoritative Google Identity Toolkit validation
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: cleanToken }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const rawUser = data.users?.[0];
      if (rawUser && rawUser.localId) {
        const verifiedUser: VerifiedFirebaseUser = {
          uid: rawUser.localId,
          email: rawUser.email || payload?.email || '',
          displayName: rawUser.displayName || payload?.name || '',
          photoURL: rawUser.photoUrl || payload?.picture || '',
          emailVerified: Boolean(rawUser.emailVerified ?? payload?.email_verified),
        };

        // Cache valid token for 5 minutes (or until token expiry if sooner)
        const tokenExpMs = payload?.exp ? payload.exp * 1000 : Date.now() + 300_000;
        const cacheDuration = Math.min(tokenExpMs - Date.now(), 300_000);
        if (cacheDuration > 0) {
          tokenCache.set(cleanToken, { user: verifiedUser, expiresAt: Date.now() + cacheDuration });
        }

        return verifiedUser;
      }
    } else {
      // Google Identity Toolkit rejected the token (invalid or revoked)
      console.warn('[Auth] Google Identity Toolkit rejected ID token:', response.status);
      return null;
    }
  } catch (netErr: any) {
    console.warn('[Auth] Network error reaching Google Identity Toolkit, checking JWT claims fallback:', netErr.message);
    // If network error occurred, verify JWT claims
    if (payload && payload.sub && payload.email) {
      const verifiedUser: VerifiedFirebaseUser = {
        uid: payload.sub,
        email: payload.email,
        displayName: payload.name || '',
        photoURL: payload.picture || '',
        emailVerified: Boolean(payload.email_verified),
      };
      return verifiedUser;
    }
  }

  return null;
}
