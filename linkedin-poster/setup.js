#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "config.json");
const EXAMPLE_PATH = path.join(__dirname, "config.example.json");
const DROP_FOLDER = path.join(__dirname, "drop");
const POSTED_FOLDER = path.join(__dirname, "posted");

console.log(`
╔══════════════════════════════════════════════════╗
║   LinkedIn Headshot Poster — Setup               ║
╚══════════════════════════════════════════════════╝

Follow these steps to get your LinkedIn API credentials:

1. Go to https://www.linkedin.com/developers/apps
2. Create a new app (or use an existing one)
3. Under "Auth" tab, add the redirect URL:
   https://www.linkedin.com/developers/tools/oauth/redirect
4. Request/verify these OAuth scopes:
   - openid
   - profile
   - w_member_social
5. Use the OAuth Token Tool to generate an access token:
   https://www.linkedin.com/developers/tools/oauth
6. Get your person URN:
   curl -H "Authorization: Bearer YOUR_TOKEN" \\
     "https://api.linkedin.com/v2/userinfo"
   → Your person URN is: urn:li:person:<your sub value>
`);

// Create folders
for (const dir of [DROP_FOLDER, POSTED_FOLDER]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created ${path.relative(__dirname, dir)}/`);
  } else {
    console.log(`✓  ${path.relative(__dirname, dir)}/ already exists`);
  }
}

// Create config if missing
if (!fs.existsSync(CONFIG_PATH)) {
  fs.copyFileSync(EXAMPLE_PATH, CONFIG_PATH);
  console.log(`✅ Created config.json from template`);
  console.log(`\n→ Edit config.json with your LinkedIn credentials and business info.`);
} else {
  console.log(`✓  config.json already exists`);
}

console.log(`
Next steps:
  1. Edit config.json with your credentials
  2. Drop headshot images into the drop/ folder
  3. Run: npm run watch
     (or post one at a time: npm run post -- drop/photo.jpg)
`);
