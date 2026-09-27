/**
 * YouTube Utility & Security Sanitizer
 *
 * Validates and extracts YouTube video IDs from various YouTube URL formats:
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 *
 * Strictly prevents arbitrary iframe sources or untrusted domains.
 */

export function extractYouTubeVideoId(url?: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();

  // Strict regex matching only trusted YouTube hosts
  const regExp = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{10,20})(?:[?&].*)?$/;
  const match = trimmed.match(regExp);

  return match && match[1] ? match[1] : null;
}

export function isValidYouTubeUrl(url?: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}

export function getYouTubeEmbedUrl(url?: string): string | null {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;
  // Official YouTube embed URL, rel=0 prevents unrelated video suggestions, autoplay=0 prevents unwanted autoplay
  return `https://www.youtube.com/embed/${videoId}?rel=0&autoplay=0`;
}
