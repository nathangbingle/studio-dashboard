#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getWorkspaces, getLinkedInAccount } from "./publer-api.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "config.json");
const DROP_FOLDER = path.join(__dirname, "drop");
const POSTED_FOLDER = path.join(__dirname, "posted");

const apiKey = process.env.PUBLER_API_KEY || process.argv[2];

if (!apiKey) {
  console.log("Usage: node setup.js <PUBLER_API_KEY>");
  console.log("   or: PUBLER_API_KEY=xxx node setup.js");
  process.exit(1);
}

// Create folders
for (const dir of [DROP_FOLDER, POSTED_FOLDER]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created ${path.relative(__dirname, dir)}/`);
  }
}

// Fetch workspace
console.log("\nFetching workspaces...");
const workspaces = await getWorkspaces(apiKey);

if (!workspaces.length) {
  console.error("No workspaces found in Publer.");
  process.exit(1);
}

const workspace = workspaces[0];
console.log(`Found workspace: ${workspace.name || workspace.id}`);

// Find LinkedIn account
console.log("Looking for LinkedIn account...");
const linkedin = await getLinkedInAccount(apiKey, workspace.id);
console.log(`Found LinkedIn: ${linkedin.name} (${linkedin.type})`);

// Write config
const config = fs.existsSync(CONFIG_PATH)
  ? JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"))
  : {};

config.publer = {
  apiKey,
  workspaceId: workspace.id,
  linkedInAccountId: linkedin.id,
  linkedInName: linkedin.name,
};

if (!config.business) {
  config.business = {
    name: "",
    tagline: "Professional Headshots",
    bookingUrl: "",
    location: "",
    priceRange: "",
  };
}

if (!config.postDefaults) {
  config.postDefaults = {
    hashtags: ["#headshots", "#professionalphotography", "#linkedinheadshot", "#personalbrand", "#headshotphotographer"],
  };
}

fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

console.log("\nconfig.json updated!");
console.log(`\nReady to go:`);
console.log(`  npm run watch    — auto-post when images are dropped`);
console.log(`  npm run post     — post a single image`);
