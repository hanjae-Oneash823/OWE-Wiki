import type { Area } from 'react-easy-crop';

const CROPPED_WEBP_QUALITY = 0.9;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image for cropping'));
    image.src = url;
  });
}

/** Crops the image at `imageUrl` to `area` (in source-pixel coordinates) and re-encodes it as WebP. */
export async function getCroppedImageBlob(imageUrl: string, area: Area): Promise<Blob> {
  const image = await loadImage(imageUrl);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not supported in this browser');

  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', CROPPED_WEBP_QUALITY));
  if (!blob) throw new Error('Failed to export cropped image');
  return blob;
}
