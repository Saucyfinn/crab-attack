// Server-side attribution for Crab Attack. Static files are served from assets; only these routes reach the Worker
// (run_worker_first in wrangler.jsonc):
//   POST /api/event                                   funnel events from the game on every platform, stored in D1
//   POST /.well-known/skadnetwork/report-attribution/ Apple's copy of SKAdNetwork install postbacks (iOS ads)
//   POST /.well-known/appattribution/report-attribution/  the same for AdAttributionKit
// Nothing identifies a player: no IP address, device ID or account is stored, only the event, platform, country and
// the ad campaign tags the player arrived with.

const EVENTS = new Set(['first_open', 'round_cleared', 'purchase']);
const PLATFORMS = new Set(['web', 'ios', 'android']);
const CAMPAIGN = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid'];
// The iOS and Android apps load the game from a file, so their requests come from the "null" origin.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' };

const text = (value, max) => (typeof value === 'string' && value ? value.slice(0, max) : null);
const reply = (status, body = null) => new Response(body, { status, headers: CORS });

async function event(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return reply(400, 'Expected JSON');
  }
  if (!EVENTS.has(body?.event) || !PLATFORMS.has(body.platform)) return reply(400, 'Unknown event or platform');
  const campaign = body.campaign && typeof body.campaign === 'object' ? body.campaign : {};
  const round = Number.isInteger(body.round) && body.round > 0 && body.round < 1000 ? body.round : null;
  const value = Number.isFinite(body.value) && body.value >= 0 ? body.value : null;
  await env.DB.prepare(
    `INSERT INTO events (event, platform, round, value, currency, mode, country, ${CAMPAIGN.join(', ')})
     VALUES (${Array(7 + CAMPAIGN.length).fill('?').join(', ')})`
  ).bind(
    body.event, body.platform, round, value, text(body.currency, 3), text(body.mode, 20), request.cf?.country ?? null,
    ...CAMPAIGN.map(key => text(campaign[key], 200))
  ).run();
  return reply(204);
}

// Apple signs each postback; ad networks verify the signature themselves, so the copy is kept as received.
async function postback(request, env, kind) {
  const body = await request.text();
  if (body.length > 20000) return reply(413);
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return reply(400, 'Expected JSON');
  }
  await env.DB.prepare(
    `INSERT INTO postbacks (kind, ad_network, source, conversion_value, coarse_value, sequence, body)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    kind,
    text(parsed['ad-network-id'], 100),
    text(String(parsed['source-identifier'] ?? parsed['source-domain'] ?? parsed['source-app-id'] ?? ''), 100),
    Number.isInteger(parsed['conversion-value']) ? parsed['conversion-value'] : null,
    text(parsed['coarse-conversion-value'], 10),
    Number.isInteger(parsed['postback-sequence-index']) ? parsed['postback-sequence-index'] : null,
    body
  ).run();
  return reply(200);
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === 'OPTIONS') return reply(204);
    if (request.method !== 'POST') return env.ASSETS.fetch(request);
    if (pathname === '/api/event') return event(request, env);
    if (pathname === '/.well-known/skadnetwork/report-attribution/') return postback(request, env, 'skadnetwork');
    if (pathname === '/.well-known/appattribution/report-attribution/') return postback(request, env, 'adattributionkit');
    return reply(404);
  }
};
