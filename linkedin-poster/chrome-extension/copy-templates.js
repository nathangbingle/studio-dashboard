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
