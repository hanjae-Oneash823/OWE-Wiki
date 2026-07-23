const MAX_DIMENSION_PX = 1600;
const WEBP_QUALITY = 0.82;

/** Downscales and re-encodes an image as WebP client-side to keep storage usage low. Falls back to the original file if the browser can't process it. */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
    return blob ?? file;
  } catch {
    return file;
  }
}
