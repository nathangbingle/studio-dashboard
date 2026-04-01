/**
 * Generates LinkedIn post copy for headshot marketing.
 * Alternates between client spotlight and booking promo styles.
 */

const spotlightTemplates = [
  (biz) =>
    `Another day, another transformation.

There's something powerful about showing up online as the best version of yourself. A strong headshot doesn't just fill a profile picture — it tells people you're serious about what you do.

If your LinkedIn photo is more than a year old, it might be time.

${biz.bookingUrl ? `Book your session: ${biz.bookingUrl}` : "DM me to book your session."}

${formatHashtags(biz)}`,

  (biz) =>
    `First impressions happen in milliseconds — and on LinkedIn, your headshot IS your first impression.

We recently wrapped another session at ${biz.name || "the studio"} and the results speak for themselves.

Investing in a professional headshot is one of the highest-ROI moves you can make for your personal brand.

${biz.bookingUrl ? `Ready? ${biz.bookingUrl}` : "Ready? Send me a message."}

${formatHashtags(biz)}`,

  (biz) =>
    `Your network is judging your profile photo. (Yes, really.)

Studies show profiles with professional headshots get 14x more views. This client came in not knowing what to expect and left with a photo that actually represents who they are.

${biz.location ? `📍 ${biz.location}` : ""}
${biz.bookingUrl ? `🔗 ${biz.bookingUrl}` : "DM me for details."}

${formatHashtags(biz)}`,

  (biz) =>
    `Before → After energy, but make it professional.

A great headshot isn't about looking perfect. It's about looking like YOU — confident, approachable, and ready to do business.

Another happy client, another photo they're proud to put front and center.

${biz.priceRange ? `Sessions starting at ${biz.priceRange}.` : ""}
${biz.bookingUrl ? `Book here: ${biz.bookingUrl}` : "Reach out to book."}

${formatHashtags(biz)}`,
];

const promoTemplates = [
  (biz) =>
    `📸 Headshot sessions are OPEN for booking.

Whether you're job hunting, launching a business, or just leveling up your LinkedIn presence — a professional headshot is step one.

What's included:
✓ 30-minute guided session
✓ Professional lighting & direction
✓ Retouched final selects
✓ Same-week delivery

${biz.priceRange ? `Starting at ${biz.priceRange}.` : ""}
${biz.location ? `📍 ${biz.location}` : ""}
${biz.bookingUrl ? `Book now → ${biz.bookingUrl}` : "DM to reserve your spot."}

${formatHashtags(biz)}`,

  (biz) =>
    `Still using that cropped photo from 2019? Let's fix that.

I'm booking headshot sessions for this month and spots are limited. ${biz.location ? `Come through to ${biz.location} and ` : ""}walk out with a headshot that actually works for you.

${biz.priceRange ? `Investment: ${biz.priceRange}` : ""}
Quick turnaround. No awkward poses. Just you, looking great.

${biz.bookingUrl ? `Grab your slot: ${biz.bookingUrl}` : "Drop a comment or DM me to book."}

${formatHashtags(biz)}`,

  (biz) =>
    `Your headshot is doing more work than you think.

It's on every connection request. Every message. Every search result. If it's not making people want to click, it's costing you opportunities.

I have a few spots open this month for professional headshot sessions.

${biz.priceRange ? `${biz.priceRange} · ` : ""}Quick session · Big upgrade.

${biz.bookingUrl ? `${biz.bookingUrl}` : "Comment "HEADSHOT" and I'll send you the details."}

${formatHashtags(biz)}`,

  (biz) =>
    `POV: You just updated your LinkedIn headshot and the messages start rolling in.

It's not magic — it's the power of a professional first impression.

I'm opening up limited headshot sessions this month at ${biz.name || "the studio"}.

Here's what you get:
→ Expert posing direction (no awkwardness, I promise)
→ Professional retouching
→ Digital files ready for LinkedIn, email, and your website

${biz.bookingUrl ? `Reserve your spot: ${biz.bookingUrl}` : "DM me before they're gone."}

${formatHashtags(biz)}`,
];

function formatHashtags(biz) {
  const defaults = [
    "#headshots",
    "#professionalphotography",
    "#linkedinheadshot",
    "#personalbrand",
    "#headshotphotographer",
  ];
  const tags = biz.hashtags || defaults;
  return tags.join(" ");
}

let spotlightIndex = 0;
let promoIndex = 0;
let lastType = "promo";

/**
 * Generate post copy. Alternates between spotlight and promo styles.
 * Pass type = "spotlight" | "promo" | "auto" to control style.
 */
export function generatePostCopy(businessConfig, type = "auto") {
  const biz = {
    ...businessConfig,
    hashtags: businessConfig.hashtags,
  };

  let chosen;

  if (type === "auto") {
    // Alternate between types
    type = lastType === "spotlight" ? "promo" : "spotlight";
  }

  if (type === "spotlight") {
    chosen = spotlightTemplates[spotlightIndex % spotlightTemplates.length](biz);
    spotlightIndex++;
    lastType = "spotlight";
  } else {
    chosen = promoTemplates[promoIndex % promoTemplates.length](biz);
    promoIndex++;
    lastType = "promo";
  }

  // Clean up extra blank lines
  return chosen.replace(/\n{3,}/g, "\n\n").trim();
}
