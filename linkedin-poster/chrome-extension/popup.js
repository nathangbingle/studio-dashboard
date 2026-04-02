// --- Config ---
const PUBLER_API_KEY = "120443c54a5803b73bb45bb170e45506eb391de149d3e734";
const PUBLER_WORKSPACE_ID = "69a4e71173e957e8eeebe8a5";
const PUBLER_LINKEDIN_ACCOUNT_ID = "69cdcfeb849b6f668d05eb97";
const API_BASE = "https://app.publer.com/api/v1";

// --- Copy templates (inline) ---
const HASHTAGS = "#headshots #professionalphotography #linkedinheadshot #personalbrand #headshotphotographer";

const SPOTLIGHT = [
  () => `Another day, another transformation.

There's something powerful about showing up online as the best version of yourself. A strong headshot doesn't just fill a profile picture — it tells people you're serious about what you do.

If your LinkedIn photo is more than a year old, it might be time.

DM me to book your session.

${HASHTAGS}`,

  () => `First impressions happen in milliseconds — and on LinkedIn, your headshot IS your first impression.

We recently wrapped another session at Nathan Bingle Photography and the results speak for themselves.

Investing in a professional headshot is one of the highest-ROI moves you can make for your personal brand.

Ready? Send me a message.

${HASHTAGS}`,

  () => `Your network is judging your profile photo. (Yes, really.)

Studies show profiles with professional headshots get 14x more views. This client came in not knowing what to expect and left with a photo that actually represents who they are.

📍 Fort Mill, South Carolina
DM me for details.

${HASHTAGS}`,

  () => `Before → After energy, but make it professional.

A great headshot isn't about looking perfect. It's about looking like YOU — confident, approachable, and ready to do business.

Another happy client, another photo they're proud to put front and center.

Reach out to book.

${HASHTAGS}`,
];

const PROMO = [
  () => `📸 Headshot sessions are OPEN for booking.

Whether you're job hunting, launching a business, or just leveling up your LinkedIn presence — a professional headshot is step one.

What's included:
✓ 30-minute guided session
✓ Professional lighting & direction
✓ Retouched final selects
✓ Same-week delivery

📍 Fort Mill, South Carolina
DM to reserve your spot.

${HASHTAGS}`,

  () => `Still using that cropped photo from 2019? Let's fix that.

I'm booking headshot sessions for this month and spots are limited. Come through to Fort Mill, South Carolina and walk out with a headshot that actually works for you.

Quick turnaround. No awkward poses. Just you, looking great.

Drop a comment or DM me to book.

${HASHTAGS}`,

  () => `Your headshot is doing more work than you think.

It's on every connection request. Every message. Every search result. If it's not making people want to click, it's costing you opportunities.

I have a few spots open this month for professional headshot sessions.

Quick session · Big upgrade.

Comment "HEADSHOT" and I'll send you the details.

${HASHTAGS}`,

  () => `POV: You just updated your LinkedIn headshot and the messages start rolling in.

It's not magic — it's the power of a professional first impression.

I'm opening up limited headshot sessions this month at Nathan Bingle Photography.

Here's what you get:
→ Expert posing direction (no awkwardness, I promise)
→ Professional retouching
→ Digital files ready for LinkedIn, email, and your website

DM me before they're gone.

${HASHTAGS}`,
];

let spotIdx = 0;
let promoIdx = 0;
let lastType = "promo";

function generateCopy(type) {
  if (type === "auto") {
    type = lastType === "spotlight" ? "promo" : "spotlight";
  }
  let text;
  if (type === "spotlight") {
    text = SPOTLIGHT[spotIdx % SPOTLIGHT.length]();
    spotIdx++;
    lastType = "spotlight";
  } else {
    text = PROMO[promoIdx % PROMO.length]();
    promoIdx++;
    lastType = "promo";
  }
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

// --- DOM ---
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const thumbs = document.getElementById("thumbs");
const postBtn = document.getElementById("postBtn");
const statusEl = document.getElementById("status");
const previewBox = document.getElementById("previewBox");
const previewText = document.getElementById("previewText");
const logEntries = document.getElementById("logEntries");

let selectedFiles = [];
let postType = "auto";

// Type buttons
document.querySelectorAll(".type-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".type-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    postType = btn.dataset.type;
  });
});

// File selection
dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  selectedFiles = Array.from(fileInput.files);
  updateThumbs();
});

function updateThumbs() {
  thumbs.innerHTML = "";
  if (selectedFiles.length === 0) {
    dropZone.querySelector("p").textContent = "Click to select headshot images";
    dropZone.classList.remove("has-files");
    postBtn.disabled = true;
    return;
  }

  dropZone.querySelector("p").innerHTML = `<span class="count">${selectedFiles.length}</span> image${selectedFiles.length > 1 ? "s" : ""} selected`;
  dropZone.classList.add("has-files");
  postBtn.disabled = false;

  selectedFiles.slice(0, 6).forEach((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    thumbs.appendChild(img);
  });
}

// --- Publer API ---
async function uploadToPubler(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/media`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer-API ${PUBLER_API_KEY}`,
      "Publer-Workspace-Id": PUBLER_WORKSPACE_ID,
    },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function publishToPubler(text, mediaId) {
  const res = await fetch(`${API_BASE}/posts/schedule/publish`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer-API ${PUBLER_API_KEY}`,
      "Publer-Workspace-Id": PUBLER_WORKSPACE_ID,
      "Content-Type": "application/json",
    },
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
          accounts: [{ id: PUBLER_LINKEDIN_ACCOUNT_ID }],
        }],
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Publish failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function pollJob(jobId) {
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${API_BASE}/job_status/${jobId}`, {
      headers: {
        "Authorization": `Bearer-API ${PUBLER_API_KEY}`,
        "Publer-Workspace-Id": PUBLER_WORKSPACE_ID,
      },
    });
    if (!res.ok) continue;
    const data = await res.json();
    if (data.status === "complete") return data;
    if (data.status === "failed") throw new Error("Publer job failed");
  }
  throw new Error("Timed out waiting for Publer");
}

// --- Post flow ---
postBtn.addEventListener("click", async () => {
  postBtn.disabled = true;
  const files = [...selectedFiles];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const num = files.length > 1 ? ` (${i + 1}/${files.length})` : "";

    statusEl.className = "status posting";
    statusEl.textContent = `Posting ${file.name}${num}...`;

    try {
      // Generate caption
      const caption = generateCopy(postType);

      // Upload image
      statusEl.textContent = `Uploading ${file.name}${num}...`;
      const media = await uploadToPubler(file);

      // Publish
      statusEl.textContent = `Publishing ${file.name}${num}...`;
      const result = await publishToPubler(caption, media.id);

      // Poll if needed
      if (result.job_id) {
        statusEl.textContent = `Waiting for LinkedIn${num}...`;
        await pollJob(result.job_id);
      }

      statusEl.className = "status success";
      statusEl.textContent = `Posted ${file.name}!`;

      previewBox.style.display = "block";
      previewText.textContent = caption;

      // Save to log
      saveLog({ file: file.name, type: postType, timestamp: new Date().toISOString() });

    } catch (err) {
      statusEl.className = "status error";
      statusEl.textContent = `Failed: ${err.message}`;
      saveLog({ file: file.name, error: err.message, timestamp: new Date().toISOString() });
    }
  }

  // Reset
  selectedFiles = [];
  fileInput.value = "";
  updateThumbs();
  loadLog();
});

// --- Log ---
function saveLog(entry) {
  chrome.storage.local.get("postLog", (data) => {
    let log = data.postLog || [];
    log.push(entry);
    if (log.length > 50) log = log.slice(-50);
    chrome.storage.local.set({ postLog: log });
  });
}

function loadLog() {
  chrome.storage.local.get("postLog", (data) => {
    const log = (data.postLog || []).reverse().slice(0, 5);
    if (log.length === 0) {
      logEntries.innerHTML = '<span style="font-size:11px;color:#aaa">No posts yet</span>';
      return;
    }
    logEntries.innerHTML = log.map((e) =>
      `<div class="log-item">${e.file} — ${e.error ? '<span style="color:#c0392b">' + e.error + '</span>' : new Date(e.timestamp).toLocaleString()}</div>`
    ).join("");
  });
}

loadLog();
