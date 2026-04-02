import { watch } from "chokidar";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { postToLinkedIn } from "./publer-api.js";
import { generatePostCopy } from "./copy-generator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG_PATH = path.join(__dirname, "config.json");
const DROP_FOLDER = path.join(__dirname, "drop");
const POSTED_FOLDER = path.join(__dirname, "posted");
const LOG_PATH = path.join(__dirname, "post-log.json");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error("config.json not found.");
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  if (!config.publer?.apiKey || !config.publer?.workspaceId) {
    console.error("Missing publer.apiKey or publer.workspaceId in config.json");
    process.exit(1);
  }
  return config;
}

function ensureDirs() {
  for (const dir of [DROP_FOLDER, POSTED_FOLDER]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function appendLog(entry) {
  let log = [];
  if (fs.existsSync(LOG_PATH)) {
    log = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8"));
  }
  log.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

function isImage(filePath) {
  return IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function optimizeImage(inputPath, outputPath) {
  await sharp(inputPath)
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toFile(outputPath);
}

// Queue to process one image at a time
const queue = [];
let processing = false;

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  const filePath = queue.shift();
  const filename = path.basename(filePath);
  console.log(`\n--- Processing: ${filename} ---`);

  // Detect post type from filename
  let type = "auto";
  const lower = filename.toLowerCase();
  if (lower.includes("promo") || lower.includes("booking")) {
    type = "promo";
  } else if (lower.includes("client") || lower.includes("spotlight")) {
    type = "spotlight";
  }

  try {
    const config = loadConfig();
    const postText = generatePostCopy(
      { ...config.business, hashtags: config.postDefaults?.hashtags },
      type
    );

    // Optimize image to temp file
    const tmpPath = path.join(POSTED_FOLDER, `_tmp_${filename}.jpg`);
    await optimizeImage(filePath, tmpPath);

    console.log(`\n${postText}\n`);

    // Post via Publer
    const jobId = await postToLinkedIn(config, tmpPath, postText);

    // Clean up: move original to posted, remove temp
    const dest = path.join(POSTED_FOLDER, filename);
    fs.renameSync(filePath, dest);
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

    console.log(`Done! Moved to posted/${filename}\n`);

    appendLog({
      file: filename,
      type,
      jobId,
      timestamp: new Date().toISOString(),
      copy: postText,
    });
  } catch (err) {
    console.error(`Failed to post ${filename}:`, err.message);
    appendLog({
      file: filename,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }

  processing = false;
  processQueue(); // process next in queue
}

// --- Main ---
ensureDirs();
loadConfig();

console.log(`
LinkedIn Headshot Poster (via Publer)
======================================
Drop folder:  ${DROP_FOLDER}
Posted moved:  ${POSTED_FOLDER}

Drop .jpg/.jpeg/.png/.webp images into drop/
They auto-post to LinkedIn via Publer.

Tip: include 'promo' or 'client' in filename to control post style.
Press Ctrl+C to stop.
`);

const watcher = watch(DROP_FOLDER, {
  ignoreInitial: false,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 500,
  },
});

watcher.on("add", (filePath) => {
  if (isImage(filePath)) {
    queue.push(filePath);
    processQueue();
  }
});

watcher.on("error", (err) => {
  console.error("Watcher error:", err.message);
});
