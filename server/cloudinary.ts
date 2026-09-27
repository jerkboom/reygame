import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import crypto from 'crypto';

// Initialize Cloudinary with server-side environment variables
// Note: CLOUDINARY_API_SECRET is server-only and NEVER sent to browser
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL,
    secure: true,
  });
} else if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export function isCloudinaryConfigured(): boolean {
  if (process.env.CLOUDINARY_URL) return true;
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

export interface CloudinaryUploadResult {
  success: boolean;
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  error?: string;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validates and uploads a game cover image to Cloudinary using signed server-side upload.
 * Stores files under reyGames/games/{gameId}/cover (or reyGames/covers for new games).
 */
export async function uploadGameCoverToCloudinary(
  base64DataUri: string,
  options: {
    gameId?: string;
    fileName?: string;
    customFolder?: string;
  } = {}
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server environment variables.'
    );
  }

  // 1. Validate Base64 Data URI
  if (!base64DataUri || typeof base64DataUri !== 'string') {
    throw new Error('Invalid image payload: Base64 data string is required.');
  }

  const matches = base64DataUri.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!matches || matches.length < 3) {
    throw new Error('Invalid base64 image data URI format.');
  }

  const mimeType = matches[1].toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(
      `Unsupported image MIME type: "${mimeType}". Allowed formats: JPEG, JPG, PNG, WEBP.`
    );
  }

  // 2. Validate Size Server-side
  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.length === 0) {
    throw new Error('Empty image payload rejected.');
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `Image size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds 5 MB limit.`
    );
  }

  // 3. Determine Cloudinary Folder and Public ID
  const safeGameId = options.gameId ? options.gameId.replace(/[^a-zA-Z0-9_-]/g, '_') : null;
  const folder = safeGameId ? `reyGames/games/${safeGameId}` : 'reyGames/covers';
  const publicId = safeGameId ? 'cover' : `cover_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  // 4. Perform Signed Cloudinary Upload with Quality Optimization
  const uploadOptions = {
    folder,
    public_id: publicId,
    overwrite: true,
    resource_type: 'image' as const,
    transformation: [
      {
        quality: 'auto',
        fetch_format: 'auto',
        width: 1200,
        crop: 'limit',
      },
    ],
  };

  try {
    const result: UploadApiResponse = await cloudinary.uploader.upload(base64DataUri, uploadOptions);

    return {
      success: true,
      url: result.url,
      secureUrl: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
    };
  } catch (err: any) {
    console.error('[Cloudinary] Upload failure:', err.message || err);
    throw new Error(`Cloudinary upload failed: ${err.message || 'Service error'}`);
  }
}

/**
 * Deletes a previously uploaded asset from Cloudinary (e.g. upon image replacement).
 */
export async function deleteCloudinaryAsset(publicId: string): Promise<boolean> {
  if (!isCloudinaryConfigured() || !publicId) return false;
  try {
    const res = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    return res.result === 'ok';
  } catch (err: any) {
    console.warn('[Cloudinary] Delete note:', err.message || err);
    return false;
  }
}
