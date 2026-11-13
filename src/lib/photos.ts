/* Photo feed: shrink on the phone before upload, so photos stay small (Supabase's free storage) and quick to load.
   Every photo is redrawn on a canvas, which also drops EXIF data (GPS included). */

export const PHOTO_MAX = 1600;
export const PHOTO_SOFT_LIMIT = 1_500_000; // above this, encode again at a lower quality
export const PHOTO_HARD_LIMIT = 2_000_000; // the bucket's cap

/** Scale (w, h) so the long side is at most `max`, never up. */
export function fitSize(w: number, h: number, max = PHOTO_MAX): { width: number; height: number } {
  const k = Math.min(1, max / Math.max(w, h, 1));
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

export interface Shrunk { blob: Blob; width: number; height: number }
interface Img { width: number; height: number; close?: () => void }
export interface PhotoIO {
  decode: (file: Blob) => Promise<Img>;
  encode: (img: Img, width: number, height: number, quality: number) => Promise<Blob>;
}

const browserIO: PhotoIO = {
  decode: (file) => createImageBitmap(file, { imageOrientation: 'from-image' }),
  encode: (img, width, height, quality) => {
    const c = document.createElement('canvas'); c.width = width; c.height = height;
    c.getContext('2d')!.drawImage(img as ImageBitmap, 0, 0, width, height);
    return new Promise((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('photo-unreadable'))), 'image/jpeg', quality));
  },
};

/** A JPEG at most 1600 px on the long side (quality 0.8, or 0.6 when that's still big). Throws 'photo-unreadable'
    or 'photo-too-big'. */
export async function shrinkPhoto(file: Blob, io: PhotoIO = browserIO): Promise<Shrunk> {
  let img: Img;
  try { img = await io.decode(file); } catch { throw new Error('photo-unreadable'); }
  try {
    const { width, height } = fitSize(img.width, img.height);
    let blob = await io.encode(img, width, height, 0.8);
    if (blob.size > PHOTO_SOFT_LIMIT) blob = await io.encode(img, width, height, 0.6);
    if (blob.size > PHOTO_HARD_LIMIT) throw new Error('photo-too-big');
    return { blob, width, height };
  } finally { img.close?.(); }
}

/** Where a photo lives in the pet-photos bucket (the policies check the first folder is the pet). */
export const photoPath = (catId: string, id: string = crypto.randomUUID()) => `${catId}/${id}.jpg`;

/** "just now", "5 min", "3 h", "2 d", then the date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
