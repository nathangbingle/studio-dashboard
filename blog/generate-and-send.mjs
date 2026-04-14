#!/usr/bin/env node
/**
 * Weekly blog poster.
 *
 * Reads blog/schedule.json, picks events happening in the next 14 days,
 * asks Claude to write a blog post about them, then emails the post to
 * a Squarespace email-to-blog address so it publishes automatically.
 *
 * Env vars required (set as GitHub Actions secrets):
 *   ANTHROPIC_API_KEY       - Claude API key
 *   SQUARESPACE_BLOG_EMAIL  - the email-to-blog address from Squarespace
 *   SMTP_HOST               - SMTP server host (e.g. smtp.gmail.com)
 *   SMTP_PORT               - SMTP server port (e.g. 465 for SSL, 587 for STARTTLS)
 *   SMTP_USER               - SMTP username
 *   SMTP_PASS               - SMTP password or app password
 *   SMTP_FROM               - From address (must match SMTP_USER for most providers)
 *
 * Optional:
 *   LOOKAHEAD_DAYS          - how many days ahead to look (default: 14)
 *   DRY_RUN                 - if "true", write post to stdout & blog/posts/ without emailing
 */

import Anthropic from "@anthropic-ai/sdk";
import nodemailer from "nodemailer";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SCHEDULE_PATH = join(__dirname, "schedule.json");
const POSTS_DIR = join(__dirname, "posts");

const LOOKAHEAD_DAYS = Number(process.env.LOOKAHEAD_DAYS ?? 14);
const DRY_RUN = process.env.DRY_RUN === "true";

function requireEnv(name) {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return val;
}

function formatDate(d) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function daysBetween(a, b) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}

async function loadUpcomingEvents() {
  const raw = await readFile(SCHEDULE_PATH, "utf8");
  const schedule = JSON.parse(raw);
  const events = schedule.events ?? [];

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + LOOKAHEAD_DAYS);

  return events
    .map((e) => ({ ...e, _date: new Date(e.date) }))
    .filter((e) => !Number.isNaN(e._date.getTime()))
    .filter((e) => e._date >= now && e._date <= cutoff)
    .sort((a, b) => a._date.getTime() - b._date.getTime());
}

function buildPrompt(events) {
  const lines = events.map((e, i) => {
    const when = formatDate(e._date);
    const days = daysBetween(new Date(), e._date);
    return `${i + 1}. ${when} (in ${days} day${days === 1 ? "" : "s"})
   - Type: ${e.type}
   - School: ${e.school}
   - Audience: ${e.audience ?? "n/a"}
   - Location: ${e.location ?? "n/a"}
   - Time: ${e.time ?? "n/a"}
   - Notes: ${e.notes ?? "none"}`;
  });

  return `You are writing this week's blog post for a school and sports photography studio. The audience is parents, students, athletes, coaches, and school staff.

Here are the upcoming media days and picture days in the next ${LOOKAHEAD_DAYS} days:

${lines.join("\n\n")}

Write a friendly, informative blog post (about 400-600 words) that:
- Opens with a warm greeting and what's coming up this week/next
- Walks through each event with the practical details (when, where, what to wear/bring)
- Shares a quick tip or two (lighting, outfit choices, arriving on time, retake policies)
- Closes with a call to action (how to order photos, how to contact the studio, retake dates)

Return your response as a JSON object with exactly these fields:
{
  "title": "A catchy blog post title (max 80 chars)",
  "html": "The full blog post body as clean HTML (<h2>, <p>, <ul>, <strong>, etc. -- no <html>, <head>, <body> tags)"
}

Respond with ONLY the JSON object, no markdown code fences, no commentary.`;
}

async function generatePost(events) {
  const client = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  const prompt = buildPrompt(events);

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  // Strip accidental code fences just in case.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Claude did not return valid JSON:\n${text}`);
  }

  if (!parsed.title || !parsed.html) {
    throw new Error(`Claude response missing title/html:\n${text}`);
  }

  return parsed;
}

async function savePostToRepo({ title, html }) {
  await mkdir(POSTS_DIR, { recursive: true });
  const slug =
    new Date().toISOString().slice(0, 10) +
    "-" +
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  const file = join(POSTS_DIR, `${slug}.html`);
  const body = `<!-- title: ${title} -->\n<!-- generated: ${new Date().toISOString()} -->\n${html}\n`;
  await writeFile(file, body, "utf8");
  return file;
}

async function sendEmail({ title, html }) {
  const transporter = nodemailer.createTransport({
    host: requireEnv("SMTP_HOST"),
    port: Number(requireEnv("SMTP_PORT")),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASS"),
    },
  });

  const info = await transporter.sendMail({
    from: requireEnv("SMTP_FROM"),
    to: requireEnv("SQUARESPACE_BLOG_EMAIL"),
    subject: title,
    html,
  });

  return info.messageId;
}

async function main() {
  console.log(`[blog-poster] Loading schedule from ${SCHEDULE_PATH}`);
  const events = await loadUpcomingEvents();
  console.log(`[blog-poster] Found ${events.length} event(s) in the next ${LOOKAHEAD_DAYS} days`);

  if (events.length === 0) {
    console.log("[blog-poster] No upcoming events. Skipping post this week.");
    return;
  }

  console.log("[blog-poster] Asking Claude to write the post...");
  const post = await generatePost(events);
  console.log(`[blog-poster] Generated post: "${post.title}"`);

  const savedPath = await savePostToRepo(post);
  console.log(`[blog-poster] Archived post to ${savedPath}`);

  if (DRY_RUN) {
    console.log("[blog-poster] DRY_RUN=true -- skipping email send.");
    console.log("---BEGIN POST---");
    console.log(post.html);
    console.log("---END POST---");
    return;
  }

  console.log("[blog-poster] Emailing post to Squarespace...");
  const messageId = await sendEmail(post);
  console.log(`[blog-poster] Sent. Message ID: ${messageId}`);
}

main().catch((err) => {
  console.error("[blog-poster] FAILED:", err);
  process.exit(1);
});
