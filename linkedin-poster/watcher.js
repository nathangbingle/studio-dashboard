import { watch } from "chokidar";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { postHeadshotToLinkedIn } from "./linkedin-api.js";
import { generatePostCopy } from "./copy-generator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG_PATH = path.join(__dirname, "config.json");
const DROP_FOLDER = path.join(__dirname, "drop");
const POSTED_FOLDER = path.join(__dirname, "posted");
const LOG_PATH = path.join(__dirname, "post-log.json");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error("❌ config.json not found. Copy config.example.json → config.json and fill in your credentials.");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
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

async function handleNewImage(filePath) {
  const filename = path.basename(filePath);
  console.log(`\n📸 New image detected: ${filename}`);

  // Detect post type from filename hints
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

    console.log(`\n📝 Generated copy (${type}):\n`);
    console.log(postText);
    console.log("\n---");

    const postId = await postHeadshotToLinkedIn(config, filePath, postText);

    // Move to posted folder
    const dest = path.join(POSTED_FOLDER, filename);
    fs.renameSync(filePath, dest);
    console.log(`✅ Done! Moved to posted/${filename}`);

    appendLog({
      file: filename,
      postId,
      type,
      timestamp: new Date().toISOString(),
      copy: postText,
    });
  } catch (err) {
    console.error(`❌ Failed to post ${filename}:`, err.message);
    appendLog({
      file: filename,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// --- Main ---
ensureDirs();
loadConfig(); // validate config exists on startup

console.log("👀 Watching for new headshots...");
console.log(`   Drop folder: ${DROP_FOLDER}`);
console.log(`   Posted move to: ${POSTED_FOLDER}`);
console.log("");
console.log("Drop a .jpg/.jpeg/.png/.webp into the drop/ folder to auto-post.");
console.log("Tip: include 'promo' or 'client' in the filename to control post style.");
console.log("Press Ctrl+C to stop.\n");

const watcher = watch(DROP_FOLDER, {
  ignoreInitial: false,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 500,
  },
});

watcher.on("add", (filePath) => {
  if (isImage(filePath)) {
    handleNewImage(filePath);
  }
});

watcher.on("error", (err) => {
  console.error("Watcher error:", err.message);
});
