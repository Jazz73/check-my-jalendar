import { customAlphabet } from 'nanoid';
import { db, send, readBody, cleanName } from '../../lib/db.js';

// URL-friendly, unambiguous slug (no lookalike chars).
const makeId = customAlphabet('23456789abcdefghijkmnpqrstuvwxyz', 8);

const HALF_HOUR = 30;
const DAY_MIN = 24 * 60;

function clampWindow(start, end, dStart, dEnd) {
  let s = Number.isFinite(start) ? Math.round(start / HALF_HOUR) * HALF_HOUR : dStart;
  let e = Number.isFinite(end) ? Math.round(end / HALF_HOUR) * HALF_HOUR : dEnd;
  s = Math.max(0, Math.min(DAY_MIN, s));
  e = Math.max(0, Math.min(DAY_MIN, e));
  if (e <= s) e = Math.min(DAY_MIN, s + HALF_HOUR);
  return [s, e];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const body = await readBody(req);
  const title = String(body.title || '').trim() || 'Untitled event';
  const adminName = cleanName(body.adminName);
  if (!adminName) return send(res, 400, { error: 'A name is required to create an event.' });

  const [wdS, wdE] = clampWindow(body.weekdayStartMin, body.weekdayEndMin, 1020, 1440);
  const [weS, weE] = clampWindow(body.weekendStartMin, body.weekendEndMin, 660, 1440);

  // Deduplicate + validate days (YYYY-MM-DD).
  const days = [...new Set((Array.isArray(body.days) ? body.days : [])
    .map((d) => String(d))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
  if (!days.length) return send(res, 400, { error: 'Pick at least one day.' });

  const id = makeId();
  const { error: evErr } = await db().from('events').insert({
    id,
    title,
    admin_name: adminName,
    weekday_start_min: wdS,
    weekday_end_min: wdE,
    weekend_start_min: weS,
    weekend_end_min: weE,
  });
  if (evErr) return send(res, 500, { error: evErr.message });

  const { error: dayErr } = await db()
    .from('event_days')
    .insert(days.map((day) => ({ event_id: id, day })));
  if (dayErr) return send(res, 500, { error: dayErr.message });

  return send(res, 200, { id });
}
