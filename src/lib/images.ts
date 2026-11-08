/** Phone photos are huge: scale to at most 2000 px on the long side and save as JPEG, so uploads are quick and readable. */
export async function shrinkImage(file: File, max = 2000, quality = 0.85): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.type === 'image/jpeg' && file.size < 3_000_000) return file;
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error('Could not read that photo'))), 'image/jpeg', quality));
  } catch {
    return file; // unusual formats go up as they are
  }
}
