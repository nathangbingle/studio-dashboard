import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { listImages, downloadImage } from "./drive.js";
import { uploadMedia, publishPost, waitForJob } from "./publer-api.js";
import { generatePostCopy } from "./copy-generator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTED_PATH = path.join(__dirname, "posted-ids.json");

// Load config from env vars
function getConfig() {
  return {
    google: {
      apiKey: process.env.GOOGLE_API_KEY,
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
    },
    publer: {
      apiKey: process.env.PUBLER_API_KEY,
      workspaceId: process.env.PUBLER_WORKSPACE_ID,
      linkedInAccountId: process.env.PUBLER_LINKEDIN_ACCOUNT_ID,
    },
    business: {
      name: process.env.BUSINESS_NAME || "Nathan Bingle Photography",
      location: process.env.BUSINESS_LOCATION || "Fort Mill, South Carolina",
      bookingUrl: process.env.BOOKING_URL || "",
      priceRange: process.env.PRICE_RANGE || "",
    },
    hashtags: (process.env.HASHTAGS || "#headshots #professionalphotography #linkedinheadshot #personalbrand #headshotphotographer").split(" "),
  };
}

// Track which images have been posted (persist to file)
function getPostedIds() {
  if (!fs.existsSync(POSTED_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(POSTED_PATH, "utf-8")); } catch { return []; }
}

function savePostedId(fileId) {
  const ids = getPostedIds();
  ids.push(fileId);
  // Keep last 500 IDs
  const trimmed = ids.slice(-500);
  fs.writeFileSync(POSTED_PATH, JSON.stringify(trimmed));
}

/**
 * Main flow:
 * 1. List images in Google Drive folder
 * 2. Find one that hasn't been posted yet
 * 3. Download it
 * 4. Generate caption
 * 5. Upload to Publer
 * 6. Post to LinkedIn
 */
export async function checkAndPost() {
  const config = getConfig();

  // Validate config
  if (!config.google.apiKey || !config.google.folderId) {
    throw new Error("Missing GOOGLE_API_KEY or GOOGLE_DRIVE_FOLDER_ID");
  }
  if (!config.publer.apiKey || !config.publer.workspaceId || !config.publer.linkedInAccountId) {
    throw new Error("Missing Publer env vars");
  }

  // 1. List images in Drive folder
  console.log("  Checking Google Drive folder...");
  const images = await listImages(config.google.apiKey, config.google.folderId);
  console.log(`  Found ${images.length} images in folder`);

  if (images.length === 0) {
    console.log("  No images in folder. Skipping.");
    return;
  }

  // 2. Find unposted image
  const postedIds = getPostedIds();
  const unposted = images.filter((img) => !postedIds.includes(img.id));

  if (unposted.length === 0) {
    console.log("  All images already posted. Drop new ones in the Google Drive folder.");
    return;
  }

  // Pick the oldest unposted image
  const image = unposted[0];
  console.log(`  Picking: ${image.name} (${image.id})`);

  // 3. Download
  console.log("  Downloading from Drive...");
  const imageBuffer = await downloadImage(config.google.apiKey, image.id);
  console.log(`  Downloaded (${(imageBuffer.length / 1024).toFixed(0)}KB)`);

  // 4. Generate caption
  const caption = generatePostCopy(config.business, config.hashtags);
  console.log(`  Caption generated (${caption.length} chars)`);

  // 5. Upload to Publer
  console.log("  Uploading to Publer...");
  const media = await uploadMedia(
    config.publer.apiKey,
    config.publer.workspaceId,
    imageBuffer,
    image.name
  );
  console.log(`  Uploaded (${media.id})`);

  // 6. Post to LinkedIn
  console.log("  Publishing to LinkedIn...");
  const result = await publishPost(
    config.publer.apiKey,
    config.publer.workspaceId,
    config.publer.linkedInAccountId,
    caption,
    media.id
  );

  if (result.job_id) {
    console.log("  Waiting for publish...");
    await waitForJob(config.publer.apiKey, config.publer.workspaceId, result.job_id);
  }

  // 7. Mark as posted
  savePostedId(image.id);

  console.log(`  POSTED: ${image.name}`);
  console.log(`  Caption: ${caption.substring(0, 80)}...`);
  return { file: image.name, caption };
}
