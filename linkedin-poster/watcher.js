import { watch } from "chokidar";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { generatePostCopy } from "./copy-generator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG_PATH = path.join(__dirname, "config.json");
const DROP_FOLDER = path.join(__dirname, "drop");
const READY_FOLDER = path.join(__dirname, "ready");
const LOG_PATH = path.join(__dirname, "post-log.json");

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error("config.json not found. Copy config.example.json -> config.json and fill in your business info.");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

function ensureDirs() {
  for (const dir of [DROP_FOLDER, READY_FOLDER]) {
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

async function handleNewImage(filePath) {
  const filename = path.basename(filePath);
  const nameNoExt = path.parse(filename).name;
  console.log(`\n--- New image: ${filename} ---`);

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

    // Optimize image for LinkedIn
    const optimizedPath = path.join(READY_FOLDER, `${nameNoExt}.jpg`);
    await optimizeImage(filePath, optimizedPath);

    // Save caption as text file
    const captionPath = path.join(READY_FOLDER, `${nameNoExt}.txt`);
    fs.writeFileSync(captionPath, postText);

    // Remove original from drop folder
    fs.unlinkSync(filePath);

    console.log(`\nImage optimized: ready/${nameNoExt}.jpg`);
    console.log(`Caption saved:   ready/${nameNoExt}.txt`);
    console.log(`\n--- COPY THIS TO LINKEDIN ---\n`);
    console.log(postText);
    console.log(`\n-----------------------------\n`);

    appendLog({
      file: filename,
      type,
      timestamp: new Date().toISOString(),
      outputImage: `${nameNoExt}.jpg`,
      outputCaption: `${nameNoExt}.txt`,
    });
  } catch (err) {
    console.error(`Failed to process ${filename}:`, err.message);
  }
}

// --- Main ---
ensureDirs();
loadConfig();

console.log(`
LinkedIn Headshot Poster
========================
Drop folder:  ${DROP_FOLDER}
Output folder: ${READY_FOLDER}

Drop a .jpg/.jpeg/.png/.webp into drop/ and I'll:
  1. Optimize the image for LinkedIn (1200px, high quality)
  2. Generate marketing caption
  3. Save both to ready/ folder

Tip: include 'promo' or 'client' in the filename to control post style.
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
    handleNewImage(filePath);
  }
});

watcher.on("error", (err) => {
  console.error("Watcher error:", err.message);
});
