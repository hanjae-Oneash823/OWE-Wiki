/** Requests a presigned R2 upload URL for the given content type, then PUTs the blob directly to it. Returns the resulting public URL. */
export async function uploadImageBlob(blob: Blob): Promise<string> {
  const contentType = blob.type;

  const presignResponse = await fetch('/api/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType }),
  });
  if (!presignResponse.ok) {
    const data = await presignResponse.json();
    throw new Error(data.error ?? 'Failed to get upload URL');
  }
  const { uploadUrl, publicUrl } = (await presignResponse.json()) as { uploadUrl: string; publicUrl: string };

  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!putResponse.ok) throw new Error('Failed to upload image');

  return publicUrl;
}
