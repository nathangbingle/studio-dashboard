import fs from "fs";
import path from "path";

const API_BASE = "https://app.publer.com/api/v1";

function headers(apiKey, workspaceId) {
  return {
    "Authorization": `Bearer-API ${apiKey}`,
    "Publer-Workspace-Id": workspaceId,
    "Content-Type": "application/json",
  };
}

/** List all connected accounts and return the LinkedIn one */
export async function getLinkedInAccount(apiKey, workspaceId) {
  const res = await fetch(`${API_BASE}/accounts`, {
    headers: headers(apiKey, workspaceId),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to list accounts (${res.status}): ${body}`);
  }

  const accounts = await res.json();
  const linkedin = accounts.find((a) => a.provider === "linkedin");

  if (!linkedin) {
    throw new Error("No LinkedIn account found in Publer. Connect one at app.publer.com");
  }

  return linkedin;
}

/** List all workspaces (no workspace ID header needed) */
export async function getWorkspaces(apiKey) {
  const res = await fetch(`${API_BASE}/workspaces`, {
    headers: {
      "Authorization": `Bearer-API ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to list workspaces (${res.status}): ${body}`);
  }

  return res.json();
}

/** Upload an image to Publer media library */
export async function uploadMedia(apiKey, workspaceId, imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const filename = path.basename(imagePath);
  const ext = path.extname(imagePath).toLowerCase();

  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };

  const boundary = `----PublerUpload${Date.now()}`;
  const mime = mimeTypes[ext] || "image/jpeg";

  const bodyParts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`,
    `Content-Type: ${mime}\r\n\r\n`,
  ];

  const header = Buffer.from(bodyParts.join(""));
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
    throw new Error(`Failed to upload media (${res.status}): ${errBody}`);
  }

  return res.json();
}

/** Publish a LinkedIn post with image immediately */
export async function publishPost(apiKey, workspaceId, accountId, text, mediaId) {
  const res = await fetch(`${API_BASE}/posts/schedule/publish`, {
    method: "POST",
    headers: headers(apiKey, workspaceId),
    body: JSON.stringify({
      bulk: {
        state: "scheduled",
        posts: [
          {
            networks: {
              linkedin: {
                type: "photo",
                text,
                media: [{ id: mediaId, type: "photo" }],
              },
            },
            accounts: [{ id: accountId }],
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to publish post (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.job_id || data;
}

/** Poll job status until complete */
export async function waitForJob(apiKey, workspaceId, jobId, maxAttempts = 15) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));

    const res = await fetch(`${API_BASE}/job_status/${jobId}`, {
      headers: headers(apiKey, workspaceId),
    });

    if (!res.ok) continue;

    const data = await res.json();
    if (data.status === "complete") return data;
    if (data.status === "failed") throw new Error(`Job failed: ${JSON.stringify(data)}`);
  }

  throw new Error("Job timed out after polling");
}

/** Full flow: upload image + publish to LinkedIn */
export async function postToLinkedIn(config, imagePath, postText) {
  const { apiKey, workspaceId } = config.publer;

  console.log("  → Finding LinkedIn account...");
  const account = await getLinkedInAccount(apiKey, workspaceId);
  console.log(`  → Found: ${account.name} (${account.id})`);

  console.log("  → Uploading image...");
  const media = await uploadMedia(apiKey, workspaceId, imagePath);
  console.log(`  → Uploaded (${media.id})`);

  console.log("  → Publishing post...");
  const jobId = await publishPost(apiKey, workspaceId, account.id, postText, media.id);
  console.log(`  → Job submitted (${jobId})`);

  if (typeof jobId === "string") {
    console.log("  → Waiting for publish...");
    await waitForJob(apiKey, workspaceId, jobId);
  }

  console.log("  → Posted to LinkedIn!");
  return jobId;
}
