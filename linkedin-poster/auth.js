#!/usr/bin/env node
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "config.json");
const EXAMPLE_PATH = path.join(__dirname, "config.example.json");

// Load client credentials from config.json
const configRaw = fs.existsSync(CONFIG_PATH)
  ? JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"))
  : {};

const CLIENT_ID = configRaw.linkedin?.clientId;
const CLIENT_SECRET = configRaw.linkedin?.clientSecret;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ Missing linkedin.clientId or linkedin.clientSecret in config.json");
  console.error('   Add them to config.json under "linkedin": { "clientId": "...", "clientSecret": "..." }');
  process.exit(1);
}

const REDIRECT_PORT = 3847;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const SCOPES = "openid profile w_member_social";

// Ensure config.json exists
if (!fs.existsSync(CONFIG_PATH)) {
  fs.copyFileSync(EXAMPLE_PATH, CONFIG_PATH);
}

const authUrl =
  `https://www.linkedin.com/oauth/v2/authorization?` +
  `response_type=code&` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `scope=${encodeURIComponent(SCOPES)}`;

console.log(`\n🔗 Open this URL on your phone or browser:\n`);
console.log(authUrl);
console.log(`\nWaiting for LinkedIn login...\n`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);

  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h2>Authorization failed</h2><p>${error}: ${url.searchParams.get("error_description")}</p>`);
    console.error(`❌ Auth failed: ${error}`);
    server.close();
    process.exit(1);
  }

  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end("<h2>Missing authorization code</h2>");
    return;
  }

  try {
    // Exchange code for access token
    console.log("  → Exchanging code for access token...");
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      throw new Error(`Token exchange failed (${tokenRes.status}): ${errBody}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in;
    console.log(`  → Got access token (expires in ${Math.round(expiresIn / 86400)} days)`);

    // Fetch person URN
    console.log("  → Fetching your LinkedIn profile...");
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      throw new Error(`Profile fetch failed (${profileRes.status})`);
    }

    const profile = await profileRes.json();
    const personUrn = `urn:li:person:${profile.sub}`;
    const name = profile.name || "Unknown";

    console.log(`  → Hello, ${name}! (${personUrn})`);

    // Update config.json
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    config.linkedin = {
      accessToken,
      personUrn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    console.log(`  → Saved credentials to config.json`);
    console.log(`\n✅ All set! You can now use:`);
    console.log(`   npm run watch    — auto-post when images are dropped`);
    console.log(`   npm run post     — post a single image\n`);

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <html><body style="font-family:system-ui;text-align:center;padding:60px 20px;">
        <h1 style="color:#1a6b3a">✅ Connected!</h1>
        <p>Logged in as <strong>${name}</strong></p>
        <p>You can close this tab. The poster is ready to go.</p>
      </body></html>
    `);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`<h2>Error</h2><p>${err.message}</p>`);
  }

  server.close();
});

server.listen(REDIRECT_PORT, () => {
  console.log(`Local server listening on port ${REDIRECT_PORT}...`);
});
