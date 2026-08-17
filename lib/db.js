import { createClient } from '@supabase/supabase-js';

// Server-side only. The service-role key bypasses RLS and must never reach the
// browser. Set these in Vercel: Project Settings -> Environment Variables.
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

let _client = null;

/** Lazily create a single Supabase client per warm serverless instance. */
export function db() {
  if (!url || !serviceKey) {
    throw new Error(
      'Missing SUPABASE_URL / SUPABASE_SERVICE_KEY environment variables.'
    );
  }
  if (!_client) {
    _client = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

/** Send a JSON response with the given status code. */
export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * Wrap a handler so any thrown error becomes a JSON 500 with the real message
 * (e.g. missing env vars) instead of an opaque platform 500. Makes the browser
 * error box actually useful for debugging.
 */
export function withErrors(fn) {
  return async (req, res) => {
    try {
      return await fn(req, res);
    } catch (e) {
      console.error('API error:', e);
      return send(res, 500, { error: e && e.message ? e.message : 'Server error' });
    }
  };
}

/** Parse a JSON request body (Vercel usually parses it for us; fall back to raw). */
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

/** Normalize a name for comparison/storage. Trims and collapses whitespace. */
export function cleanName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

/**
 * Confirm the supplied name is the event's admin (case-insensitive).
 * Returns the event row on success, or null if not admin / not found.
 */
export async function requireAdmin(eventId, name) {
  const { data: event } = await db()
    .from('events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) return null;
  if (cleanName(name).toLowerCase() !== cleanName(event.admin_name).toLowerCase()) {
    return null;
  }
  return event;
}
