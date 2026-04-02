/**
 * Publer API client for posting to LinkedIn.
 */

const API_BASE = "https://app.publer.com/api/v1";

function headers(apiKey, workspaceId) {
  return {
    "Authorization": `Bearer-API ${apiKey}`,
    "Publer-Workspace-Id": workspaceId,
    "Content-Type": "application/json",
  };
}

/**
 * Upload an image buffer to Publer.
 * Returns { id, path, thumbnail }
 */
export async function uploadMedia(apiKey, workspaceId, imageBuffer, filename) {
  const boundary = `----Upload${Date.now()}`;
  const mime = filename.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, imageBuffer, footer]);

  const res = await fetch(`${API_BASE}/media`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer-API ${apiKey}`,
      "Publer-Workspace-Id": workspaceId,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Publer upload failed (${res.status}): ${errBody}`);
  }

  return res.json();
}

/**
 * Publish a LinkedIn post with image immediately.
 */
export async function publishPost(apiKey, workspaceId, accountId, text, mediaId) {
  const res = await fetch(`${API_BASE}/posts/schedule/publish`, {
    method: "POST",
    headers: headers(apiKey, workspaceId),
    body: JSON.stringify({
      bulk: {
        state: "scheduled",
        posts: [{
          networks: {
            linkedin: {
              type: "photo",
              text,
              media: [{ id: mediaId, type: "photo" }],
            },
          },
          accounts: [{ id: accountId }],
        }],
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Publer publish failed (${res.status}): ${errBody}`);
  }

  return res.json();
}

/**
 * Poll job status until complete.
 */
export async function waitForJob(apiKey, workspaceId, jobId, maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${API_BASE}/job_status/${jobId}`, {
      headers: headers(apiKey, workspaceId),
    });
    if (!res.ok) continue;
    const data = await res.json();
    if (data.status === "complete") return data;
    if (data.status === "failed") throw new Error(`Publer job failed: ${JSON.stringify(data)}`);
  }
  throw new Error("Publer job timed out");
}
