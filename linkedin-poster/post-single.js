#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { postHeadshotToLinkedIn } from "./linkedin-api.js";
import { generatePostCopy } from "./copy-generator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "config.json");
const POSTED_FOLDER = path.join(__dirname, "posted");
const LOG_PATH = path.join(__dirname, "post-log.json");

const imagePath = process.argv[2];
const postType = process.argv[3] || "auto";

if (!imagePath) {
  console.log("Usage: node post-single.js <image-path> [spotlight|promo|auto]");
  console.log("");
  console.log("Examples:");
  console.log("  node post-single.js drop/headshot.jpg");
  console.log("  node post-single.js drop/headshot.jpg promo");
  console.log("  node post-single.js drop/headshot.jpg spotlight");
  process.exit(1);
}

const resolved = path.resolve(imagePath);
if (!fs.existsSync(resolved)) {
  console.error(`❌ File not found: ${resolved}`);
  process.exit(1);
}

if (!fs.existsSync(CONFIG_PATH)) {
  console.error("❌ config.json not found. Copy config.example.json → config.json and fill in your credentials.");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

const postText = generatePostCopy(
  { ...config.business, hashtags: config.postDefaults?.hashtags },
  postType
);

console.log(`📝 Post copy (${postType}):\n`);
console.log(postText);
console.log("\n---\n");

try {
  const postId = await postHeadshotToLinkedIn(config, resolved, postText);

  if (!fs.existsSync(POSTED_FOLDER)) fs.mkdirSync(POSTED_FOLDER, { recursive: true });
  const dest = path.join(POSTED_FOLDER, path.basename(resolved));
  fs.renameSync(resolved, dest);
  console.log(`✅ Posted and moved to posted/${path.basename(resolved)}`);

  // Log
  let log = [];
  if (fs.existsSync(LOG_PATH)) log = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8"));
  log.push({
    file: path.basename(resolved),
    postId,
    type: postType,
    timestamp: new Date().toISOString(),
    copy: postText,
  });
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
} catch (err) {
  console.error(`❌ Failed:`, err.message);
  process.exit(1);
}
