#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "config.json");
const EXAMPLE_PATH = path.join(__dirname, "config.example.json");

// Ensure config.json exists
if (!fs.existsSync(CONFIG_PATH)) {
  fs.copyFileSync(EXAMPLE_PATH, CONFIG_PATH);
}

// Load client credentials from config.json
const configRaw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

const CLIENT_ID = configRaw.linkedin?.clientId;
const CLIENT_SECRET = configRaw.linkedin?.clientSecret;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing linkedin.clientId or linkedin.clientSecret in config.json');
  process.exit(1);
}

// Use LinkedIn's own redirect tool — works from any browser
const REDIRECT_URI = "https://www.linkedin.com/developers/tools/oauth/redirect";
const SCOPES = "openid profile w_member_social";

const authUrl =
  `https://www.linkedin.com/oauth/v2/authorization?` +
  `response_type=code&` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `scope=${encodeURIComponent(SCOPES)}`;

console.log(`\nOpen this URL in any browser:\n`);
console.log(authUrl);
console.log(`\nAfter you authorize, LinkedIn will show you a code on the page.`);
console.log(`Copy and paste that code below.\n`);

// If a code was passed as argument, use it directly
const codeArg = process.argv[2];

async function exchangeCode(code) {
  console.log("  Exchanging code for access token...");
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
  console.log(`  Got access token (expires in ${Math.round(expiresIn / 86400)} days)`);

  console.log("  Fetching your LinkedIn profile...");
  const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profileRes.ok) {
    throw new Error(`Profile fetch failed (${profileRes.status})`);
  }

  const profile = await profileRes.json();
  const personUrn = `urn:li:person:${profile.sub}`;
  const name = profile.name || "Unknown";

  console.log(`  Hello, ${name}! (${personUrn})`);

  // Update config.json — preserve existing fields
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  config.linkedin = {
    ...config.linkedin,
    accessToken,
    personUrn,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  console.log(`  Saved credentials to config.json`);
  console.log(`\nAll set! You can now use:`);
  console.log(`  npm run watch    — auto-post when images are dropped`);
  console.log(`  npm run post     — post a single image\n`);
}

if (codeArg) {
  // Code passed as CLI argument
  await exchangeCode(codeArg.trim());
} else {
  // Interactive prompt
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question("Paste the code here: ", async (code) => {
    rl.close();
    try {
      await exchangeCode(code.trim());
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });
}
