# Autonomous Weekly Blog Poster

This folder contains a self-running weekly blog poster for the studio's
Squarespace page. Every Monday morning a GitHub Action generates a fresh blog
post about the upcoming school and sports media days / picture days and emails
it to your Squarespace email-to-blog address so it publishes automatically.

## How it works

1. **`schedule.json`** — you maintain a list of upcoming media / picture days
   here. Add an entry whenever you book a new event.
2. **`generate-and-send.mjs`** — reads the schedule, picks events happening in
   the next 14 days, asks Claude to write a friendly blog post about them, and
   emails the post to the Squarespace email-to-blog address.
3. **`../.github/workflows/weekly-blog-post.yml`** — a GitHub Actions cron
   workflow that runs the script every Monday at 13:00 UTC (~9am Eastern). It
   also archives a copy of each published post into `blog/posts/`.
4. **No upcoming events? No post.** The script quietly skips weeks when nothing
   is on the calendar — so you won't spam your blog during slow stretches.

## One-time setup

### 1. Turn on email-to-blog in Squarespace

1. In Squarespace, open your blog page settings.
2. Click **Email Posts** (or **Email-to-Post** / **Post by Email** — names vary
   by plan).
3. Copy the unique email address Squarespace gives you. Each blog post emailed
   to this address becomes a blog entry automatically.
4. Keep this address secret — anyone with it can post to your blog.

> Note: email-to-blog is available on most Squarespace plans but not all. If
> your plan doesn't include it, contact Squarespace support or upgrade.

### 2. Get an Anthropic API key

Create one at <https://console.anthropic.com/>. You'll need a small amount of
credit — each weekly post costs a fraction of a cent.

### 3. Set up an SMTP sender

You need an SMTP account the workflow can send from. Easiest options:

- **Gmail**: enable 2FA, then create an
  [App Password](https://support.google.com/accounts/answer/185833) and use:
  - `SMTP_HOST=smtp.gmail.com`
  - `SMTP_PORT=465`
  - `SMTP_USER=your.address@gmail.com`
  - `SMTP_PASS=<app password>`
  - `SMTP_FROM=your.address@gmail.com`
- **SendGrid / Mailgun / Postmark**: use the SMTP credentials from your dashboard.

### 4. Add the secrets to GitHub

Go to your repo on GitHub → **Settings** → **Secrets and variables** →
**Actions** → **New repository secret**, and add each of these:

| Secret name              | Value                                                 |
| ------------------------ | ----------------------------------------------------- |
| `ANTHROPIC_API_KEY`      | Your Anthropic API key                                |
| `SQUARESPACE_BLOG_EMAIL` | The email-to-blog address from step 1                 |
| `SMTP_HOST`              | e.g. `smtp.gmail.com`                                 |
| `SMTP_PORT`              | e.g. `465`                                            |
| `SMTP_USER`              | Your SMTP username                                    |
| `SMTP_PASS`              | Your SMTP password / app password                     |
| `SMTP_FROM`              | The from-address (usually same as `SMTP_USER`)        |

### 5. Test it

From GitHub → **Actions** → **Weekly Blog Post** → **Run workflow**. Tick the
**dry_run** box to generate a post without emailing it; the HTML will be saved
to `blog/posts/` so you can review it. Once you're happy, run it again without
dry run to send the real thing.

## Maintaining the schedule

Edit `blog/schedule.json` and add an entry like:

```json
{
  "id": "lincoln-2026-05-15",
  "date": "2026-05-15",
  "type": "picture-day",
  "school": "Lincoln High School",
  "audience": "9th-12th grade",
  "location": "Main Gym",
  "time": "8:00 AM - 2:00 PM",
  "notes": "Retakes on May 29. Order forms due May 13."
}
```

Fields:

- `date` — ISO date (YYYY-MM-DD). Past dates are ignored automatically.
- `type` — `picture-day`, `sports-media-day`, or anything descriptive.
- `school`, `audience`, `location`, `time`, `notes` — all surfaced in the post.

Commit the change and push; the next weekly run will pick it up.

## Running locally (for testing)

```bash
cd blog
npm install
export ANTHROPIC_API_KEY=sk-ant-...
DRY_RUN=true npm run post
```

With `DRY_RUN=true` the script prints the generated HTML and saves it under
`blog/posts/` but doesn't send any email, so you can iterate safely.

## Changing the schedule / cadence

- **Time of day**: edit the `cron:` line in `../.github/workflows/weekly-blog-post.yml`.
  The default `0 13 * * 1` is Monday 13:00 UTC.
- **Look-ahead window**: set `LOOKAHEAD_DAYS` in the workflow env (default 14).
- **Post more often**: change the cron to, e.g., `0 13 * * 1,4` for Monday and
  Thursday.
