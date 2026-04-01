import fs from "fs";
import path from "path";

/**
 * LinkedIn API client for image posts.
 * Uses the LinkedIn v2 API with OAuth 2.0 access tokens.
 */

const API_BASE = "https://api.linkedin.com/v2";
const UPLOAD_BASE = "https://api.linkedin.com/rest";

function headers(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "LinkedIn-Version": "202401",
    "X-Restli-Protocol-Version": "2.0.0",
    ...extra,
  };
}

/** Register an image upload and get the upload URL + asset ID */
async function initImageUpload(token, personUrn) {
  const res = await fetch(`${UPLOAD_BASE}/images?action=initializeUpload`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: personUrn,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to init image upload (${res.status}): ${body}`);
  }

  const data = await res.json();
  return {
    uploadUrl: data.value.uploadUrl,
    imageUrn: data.value.image,
  };
}

/** Upload the image binary to LinkedIn's upload URL */
async function uploadImageBinary(uploadUrl, imagePath, token) {
  const imageBuffer = fs.readFileSync(imagePath);

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    body: imageBuffer,
  });

  if (!res.ok && res.status !== 201) {
    const body = await res.text();
    throw new Error(`Failed to upload image (${res.status}): ${body}`);
  }
}

/** Create a LinkedIn post with an image */
async function createImagePost(token, personUrn, text, imageUrn) {
  const res = await fetch(`${API_BASE}/posts`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      author: personUrn,
      commentary: text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: {
          title: "Professional Headshot",
          id: imageUrn,
        },
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });

  if (!res.ok && res.status !== 201) {
    const body = await res.text();
    throw new Error(`Failed to create post (${res.status}): ${body}`);
  }

  const postId = res.headers.get("x-restli-id") || "unknown";
  return postId;
}

/** Full flow: upload image + create post */
export async function postHeadshotToLinkedIn(config, imagePath, postText) {
  const { accessToken, personUrn } = config.linkedin;

  console.log("  → Initializing image upload...");
  const { uploadUrl, imageUrn } = await initImageUpload(accessToken, personUrn);

  console.log("  → Uploading image...");
  await uploadImageBinary(uploadUrl, imagePath, accessToken);

  console.log("  → Creating post...");
  const postId = await createImagePost(accessToken, personUrn, postText, imageUrn);

  console.log(`  → Posted! (ID: ${postId})`);
  return postId;
}
