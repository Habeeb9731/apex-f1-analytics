// Caching proxy for the OpenF1 API.
//
// The browser asks /api/f1/<endpoint>?<params>; we answer from SQLite when we can and only go to
// OpenF1 on a miss or when a copy has gone stale. Finished sessions never change, so their data is
// kept for good. When OpenF1 is unavailable (rate limits, or the 401 lock it applies to anonymous
// clients during live F1 sessions) we keep serving whatever we already have.
import zlib from 'node:zlib';

const UPSTREAM = process.env.OPENF1_BASE_URL || 'https://api.openf1.org/v1';
const ENDPOINTS = new Set([
  'meetings', 'sessions', 'drivers', 'session_result', 'starting_grid', 'laps', 'position', 'race_control',
  'pit', 'stints', 'championship_drivers', 'championship_teams', 'car_data', 'location', 'weather',
]);
const PARAMS = new Set([
  'year', 'meeting_key', 'session_key', 'driver_number', 'session_name', 'session_type', 'country_name', 'lap_number',
  'position', 'date>=', 'date<=', 'date>', 'date<',
]);
const SETTLE_MS = 6 * 60 * 60 * 1000; // results can still be amended (penalties) for a few hours after a session
const TTL_MS = { short: 60 * 1000, default: 60 * 60 * 1000 };
const PACE_MS = 375;

export function createOpenF1Proxy(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS openf1_cache (
    key TEXT PRIMARY KEY,
    body BLOB NOT NULL,
    fetched_at INTEGER NOT NULL,
    expires_at INTEGER
  )`);
  const getRow = db.prepare('SELECT body, fetched_at, expires_at FROM openf1_cache WHERE key = ?');
  const putRow = db.prepare(`INSERT INTO openf1_cache (key, body, fetched_at, expires_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET body = excluded.body, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at`);

  const inflight = new Map();
  let queue = Promise.resolve();
  let lastRequestAt = 0;

  // One request to OpenF1 at a time, spaced out, with backoff on 429s.
  function upstream(endpoint, query) {
    const run = queue.then(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const wait = Math.max(0, PACE_MS - (Date.now() - lastRequestAt));
        if (wait) await sleep(wait);
        lastRequestAt = Date.now();
        const res = await fetch(`${UPSTREAM}/${endpoint}${query ? `?${query}` : ''}`, { signal: AbortSignal.timeout(30_000) });
        if (res.status === 429 && attempt < 2) {
          const retryAfter = Number(res.headers.get('retry-after'));
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * (attempt + 1));
          continue;
        }
        if (res.status === 404) return '[]'; // OpenF1 uses 404 for "no rows"
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new UpstreamError(res.status, detail);
        }
        return res.text();
      }
      throw new UpstreamError(429, 'rate limited');
    });
    queue = run.then(() => undefined, () => undefined);
    return run;
  }

  // Returns parsed rows for internal use (e.g. looking up a session's end time).
  async function load(endpoint, query) {
    const { body } = await get(endpoint, query);
    return JSON.parse(zlib.gunzipSync(body).toString('utf8'));
  }

  async function sessionEnd(sessionKey) {
    if (!/^\d+$/.test(sessionKey)) return null;
    const rows = await load('sessions', `session_key=${sessionKey}`).catch(() => []);
    const s = rows[0];
    return s ? new Date(s.date_end || s.date_start).getTime() : null;
  }

  // Decides how long a fresh copy stays valid. null = keep forever.
  async function expiryFor(endpoint, params, rows) {
    const now = Date.now();
    const sessionKey = params.get('session_key');
    if (sessionKey === 'latest' || params.get('meeting_key') === 'latest') return now + TTL_MS.short;
    if (sessionKey && endpoint !== 'sessions') {
      const end = await sessionEnd(sessionKey);
      if (end != null && end + SETTLE_MS < now) return null;
      return now + TTL_MS.short;
    }
    if (endpoint === 'sessions' && sessionKey) {
      // Read the end time from the rows we just fetched; looking it up via the cache would wait on this very request.
      const s = Array.isArray(rows) ? rows[0] : null;
      const end = s ? new Date(s.date_end || s.date_start).getTime() : null;
      if (end != null && end + SETTLE_MS < now) return null;
    }
    return now + TTL_MS.default; // schedules, standings lists, etc.
  }

  async function get(endpoint, query) {
    const key = `${endpoint}?${query}`;
    const row = getRow.get(key);
    if (row && (row.expires_at == null || row.expires_at > Date.now())) return { body: row.body, state: 'HIT' };

    if (!inflight.has(key)) {
      inflight.set(key, (async () => {
        try {
          const text = await upstream(endpoint, query);
          const rows = JSON.parse(text); // never store a non-JSON body
          const body = zlib.gzipSync(text);
          const expires = await expiryFor(endpoint, new URLSearchParams(query), rows);
          putRow.run(key, body, Date.now(), expires);
          return { body, state: 'MISS' };
        } finally {
          inflight.delete(key);
        }
      })());
    }
    try {
      return await inflight.get(key);
    } catch (error) {
      if (row) return { body: row.body, state: 'STALE' }; // OpenF1 down or locked: serve what we have
      throw error;
    }
  }

  return async function handler(req, res) {
    const endpoint = req.params.endpoint;
    if (!ENDPOINTS.has(endpoint)) return res.status(404).json({ error: 'unknown_endpoint' });
    const raw = req.originalUrl.split('?')[1] ?? '';
    if (raw.length > 600) return res.status(400).json({ error: 'query_too_long' });
    const params = new URLSearchParams(raw);
    for (const k of params.keys()) if (!PARAMS.has(k)) return res.status(400).json({ error: 'unsupported_parameter', parameter: k });
    params.sort();

    try {
      const { body, state } = await get(endpoint, params.toString());
      res.set('X-Cache', state);
      res.set('Cache-Control', state === 'HIT' ? 'public, max-age=300' : 'no-cache');
      res.type('application/json');
      res.vary('Accept-Encoding');
      if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
        res.set('Content-Encoding', 'gzip');
        return res.send(body);
      }
      return res.send(zlib.gunzipSync(body));
    } catch (error) {
      const status = error instanceof UpstreamError ? error.status : 0;
      const locked = status === 401 && /live f1 session/i.test(error.detail);
      res.set('Cache-Control', 'no-store');
      return res.status(503).json({
        error: locked ? 'openf1_locked' : status === 429 ? 'rate_limited' : 'upstream_unavailable',
        message: locked
          ? 'OpenF1 restricts data while a live F1 session is running. This view will load once the session ends.'
          : status === 429
            ? 'OpenF1 is busy right now. Please try again in a moment.'
            : 'OpenF1 could not be reached. Please try again shortly.',
      });
    }
  };
}

class UpstreamError extends Error {
  constructor(status, detail) {
    super(`OpenF1 returned ${status}`);
    this.status = status;
    this.detail = detail || '';
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
