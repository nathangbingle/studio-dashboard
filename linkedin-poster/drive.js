/**
 * Google Drive access for shared folders using API key (no OAuth needed).
 * Folder must be shared as "Anyone with the link."
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";

/**
 * List image files in the shared Google Drive folder.
 * Returns array of { id, name, mimeType }
 */
export async function listImages(apiKey, folderId) {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent("files(id,name,mimeType,createdTime)");
  const url = `${DRIVE_API}/files?q=${query}&key=${apiKey}&fields=${fields}&pageSize=100&orderBy=createdTime`;

  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive list failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const files = (data.files || []).filter((f) =>
    f.mimeType && f.mimeType.startsWith("image/")
  );

  return files;
}

/**
 * Download an image file from Google Drive.
 * Returns a Buffer.
 */
export async function downloadImage(apiKey, fileId) {
  const url = `${DRIVE_API}/files/${fileId}?alt=media&key=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive download failed (${res.status}): ${body}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Move a file to a "posted" subfolder by copying then deleting.
 * Since we only have API key (read-only), we can't move/delete.
 * Instead, we track posted file IDs locally.
 */
