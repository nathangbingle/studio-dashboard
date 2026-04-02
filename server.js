import http from "http";
import cron from "node-cron";
import { checkAndPost } from "./poster.js";

const PORT = process.env.PORT || 3000;

// Schedule: 9am, 12pm, 3pm Eastern
cron.schedule("0 9 * * *", () => run("9am"), { timezone: "America/New_York" });
cron.schedule("0 12 * * *", () => run("12pm"), { timezone: "America/New_York" });
cron.schedule("0 15 * * *", () => run("3pm"), { timezone: "America/New_York" });

async function run(label) {
  console.log(`\n[${new Date().toISOString()}] Scheduled run: ${label}`);
  try {
    await checkAndPost();
  } catch (err) {
    console.error(`[${label}] Error:`, err.message);
  }
}

// Health check server (keeps Railway alive)
const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", time: new Date().toISOString() }));
    return;
  }

  if (req.url === "/post") {
    // Manual trigger
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write("Posting...\n");
    try {
      await checkAndPost();
      res.end("Done!");
    } catch (err) {
      res.end(`Error: ${err.message}`);
    }
    return;
  }

  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h3>LinkedIn Headshot Poster</h3>
      <p>Runs at 9am, 12pm, 3pm ET</p>
      <p><a href="/post">Trigger now</a> | <a href="/health">Health</a></p>`);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`LinkedIn Headshot Poster running on port ${PORT}`);
  console.log("Schedule: 9am, 12pm, 3pm Eastern");
  console.log("Manual trigger: GET /post");
});
