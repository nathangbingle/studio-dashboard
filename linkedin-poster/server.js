import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { postToLinkedIn } from "./publer-api.js";
import { generatePostCopy } from "./copy-generator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const TMP_DIR = path.join(__dirname, "tmp");
const LOG_PATH = path.join(__dirname, "post-log.json");

// Load config from env vars (Railway) or config.json (local)
function loadConfig() {
  if (process.env.PUBLER_API_KEY) {
    return {
      publer: {
        apiKey: process.env.PUBLER_API_KEY,
        workspaceId: process.env.PUBLER_WORKSPACE_ID,
        linkedInAccountId: process.env.PUBLER_LINKEDIN_ACCOUNT_ID,
      },
      business: {
        name: process.env.BUSINESS_NAME || "Nathan Bingle Photography",
        tagline: process.env.BUSINESS_TAGLINE || "Professional Headshots",
        bookingUrl: process.env.BOOKING_URL || "",
        location: process.env.BUSINESS_LOCATION || "Fort Mill, South Carolina",
        priceRange: process.env.PRICE_RANGE || "",
      },
      postDefaults: {
        hashtags: (process.env.HASHTAGS || "#headshots #professionalphotography #linkedinheadshot #personalbrand #headshotphotographer").split(" "),
      },
    };
  }

  const configPath = path.join(__dirname, "config.json");
  if (!fs.existsSync(configPath)) {
    console.error("No config found. Set env vars or create config.json");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

function appendLog(entry) {
  let log = [];
  if (fs.existsSync(LOG_PATH)) {
    try { log = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")); } catch {}
  }
  log.push(entry);
  if (log.length > 100) log = log.slice(-100);
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

function getLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")); } catch { return []; }
}

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LinkedIn Headshot Poster</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #f7f6f2; color: #1a1a18; min-height: 100vh; padding: 20px; }
  .container { max-width: 500px; margin: 0 auto; }
  h1 { font-size: 18px; font-weight: 500; margin-bottom: 4px; }
  .sub { font-size: 13px; color: #888; margin-bottom: 24px; }
  .drop-zone {
    border: 2px dashed rgba(0,0,0,0.15);
    border-radius: 12px;
    padding: 48px 24px;
    text-align: center;
    background: #fff;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 16px;
  }
  .drop-zone.over { border-color: #1a6b3a; background: #edf7f1; }
  .drop-zone p { font-size: 15px; color: #888; }
  .drop-zone input { display: none; }
  .type-toggle { display: flex; gap: 8px; margin-bottom: 24px; }
  .type-btn {
    flex: 1; padding: 10px; border: 1px solid rgba(0,0,0,0.08);
    border-radius: 8px; background: #fff; font-family: inherit;
    font-size: 13px; cursor: pointer; text-align: center;
  }
  .type-btn.active { background: #1a1a18; color: #fff; }
  .status { padding: 16px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; display: none; }
  .status.posting { display: block; background: #eef3fb; color: #1a4d8a; }
  .status.success { display: block; background: #edf7f1; color: #1a6b3a; }
  .status.error { display: block; background: #fef0f0; color: #c0392b; }
  .log { margin-top: 24px; }
  .log h2 { font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.07em; color: #888; margin-bottom: 8px; }
  .log-item { background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; padding: 12px; margin-bottom: 8px; font-size: 12px; }
  .log-item .time { color: #888; }
  .log-item .type { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; text-transform: uppercase; }
  .log-item .type-spotlight { background: #eef3fb; color: #1a4d8a; }
  .log-item .type-promo { background: #fef8ed; color: #92600a; }
  .preview { background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; padding: 12px; margin-bottom: 16px; display: none; }
  .preview img { width: 100%; border-radius: 6px; margin-bottom: 8px; }
  .preview p { font-size: 12px; color: #555; white-space: pre-wrap; max-height: 200px; overflow-y: auto; }
</style>
</head>
<body>
<div class="container">
  <h1>LinkedIn Headshot Poster</h1>
  <p class="sub">Drop headshots to auto-post to LinkedIn</p>

  <div class="drop-zone" id="dropZone">
    <p>Tap to select or drag photos here</p>
    <input type="file" id="fileInput" accept="image/*" multiple>
  </div>

  <div class="type-toggle">
    <button class="type-btn active" data-type="auto">Auto</button>
    <button class="type-btn" data-type="spotlight">Client Spotlight</button>
    <button class="type-btn" data-type="promo">Booking Promo</button>
  </div>

  <div class="status" id="status"></div>
  <div class="preview" id="preview"></div>

  <div class="log" id="logSection">
    <h2>Recent posts</h2>
    <div id="logEntries"></div>
  </div>
</div>

<script>
  let postType = 'auto';

  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      postType = btn.dataset.type;
    });
  });

  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const status = document.getElementById('status');
  const preview = document.getElementById('preview');

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('over');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => handleFiles(fileInput.files));

  async function handleFiles(files) {
    for (const file of files) {
      await uploadAndPost(file);
    }
  }

  async function uploadAndPost(file) {
    status.className = 'status posting';
    status.textContent = 'Posting ' + file.name + '...';
    status.style.display = 'block';
    preview.style.display = 'none';

    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', postType);

    try {
      const res = await fetch('/post', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.success) {
        status.className = 'status success';
        status.textContent = 'Posted! ' + file.name;
        if (data.copy) {
          preview.style.display = 'block';
          preview.innerHTML = '<p>' + data.copy.replace(/</g, '&lt;') + '</p>';
        }
        loadLog();
      } else {
        status.className = 'status error';
        status.textContent = 'Failed: ' + (data.error || 'Unknown error');
      }
    } catch (err) {
      status.className = 'status error';
      status.textContent = 'Error: ' + err.message;
    }
  }

  async function loadLog() {
    try {
      const res = await fetch('/log');
      const log = await res.json();
      const el = document.getElementById('logEntries');
      el.innerHTML = log.reverse().slice(0, 10).map(e =>
        '<div class="log-item">' +
          '<span class="type type-' + (e.type || 'auto') + '">' + (e.type || 'auto') + '</span> ' +
          '<strong>' + (e.file || 'unknown') + '</strong> ' +
          '<span class="time">' + new Date(e.timestamp).toLocaleString() + '</span>' +
          (e.error ? '<br><span style="color:#c0392b">' + e.error + '</span>' : '') +
        '</div>'
      ).join('');
    } catch {}
  }

  loadLog();
</script>
</body>
</html>`;

// Parse multipart form data (minimal, no dependency)
function parseMultipart(buffer, boundary) {
  const parts = {};
  const boundaryBuf = Buffer.from(`--${boundary}`);
  let start = buffer.indexOf(boundaryBuf) + boundaryBuf.length + 2;

  while (start < buffer.length) {
    const end = buffer.indexOf(boundaryBuf, start);
    if (end === -1) break;

    const part = buffer.slice(start, end - 2);
    const headerEnd = part.indexOf("\r\n\r\n");
    const headerStr = part.slice(0, headerEnd).toString();
    const body = part.slice(headerEnd + 4);

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);

    if (nameMatch) {
      if (filenameMatch) {
        parts[nameMatch[1]] = { filename: filenameMatch[1], data: body };
      } else {
        parts[nameMatch[1]] = body.toString();
      }
    }

    start = end + boundaryBuf.length + 2;
  }

  return parts;
}

// Ensure tmp dir
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "")) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(HTML_PAGE);
    return;
  }

  if (req.method === "GET" && req.url === "/log") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(getLog()));
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method === "POST" && req.url === "/post") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);

    const contentType = req.headers["content-type"] || "";
    const boundaryMatch = contentType.match(/boundary=(.+)/);

    if (!boundaryMatch) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "Invalid request" }));
      return;
    }

    const parts = parseMultipart(body, boundaryMatch[1]);
    const imageData = parts.image;
    const postType = parts.type || "auto";

    if (!imageData || !imageData.data) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: "No image provided" }));
      return;
    }

    const filename = imageData.filename || `headshot_${Date.now()}.jpg`;
    const tmpInput = path.join(TMP_DIR, `in_${Date.now()}_${filename}`);
    const tmpOutput = path.join(TMP_DIR, `out_${Date.now()}_${filename}.jpg`);

    try {
      fs.writeFileSync(tmpInput, imageData.data);

      // Optimize
      await sharp(tmpInput)
        .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toFile(tmpOutput);

      const config = loadConfig();
      const postText = generatePostCopy(
        { ...config.business, hashtags: config.postDefaults?.hashtags },
        postType
      );

      console.log(`\nPosting: ${filename} (${postType})`);
      console.log(postText.substring(0, 100) + "...\n");

      const jobId = await postToLinkedIn(config, tmpOutput, postText);

      appendLog({
        file: filename,
        type: postType,
        jobId,
        timestamp: new Date().toISOString(),
        copy: postText,
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, jobId, copy: postText }));
    } catch (err) {
      console.error("Post failed:", err.message);

      appendLog({
        file: filename,
        type: postType,
        error: err.message,
        timestamp: new Date().toISOString(),
      });

      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: err.message }));
    } finally {
      // Clean up temp files
      if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
      if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
    }

    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`LinkedIn Headshot Poster running on port ${PORT}`);
  console.log(`Open in your browser to post headshots`);
});
