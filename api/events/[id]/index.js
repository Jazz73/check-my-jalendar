import { db, send, readBody, requireAdmin, withErrors } from '../../../lib/db.js';

const HALF_HOUR = 30;
const DAY_MIN = 24 * 60;

function clamp(v, dflt) {
  if (!Number.isFinite(v)) return dflt;
  let m = Math.round(v / HALF_HOUR) * HALF_HOUR;
  return Math.max(0, Math.min(DAY_MIN, m));
}

export default withErrors(async function handler(req, res) {
  const id = req.query.id;
  if (!id) return send(res, 400, { error: 'Missing event id.' });

  if (req.method === 'GET') return getSnapshot(res, id);
  if (req.method === 'PUT') return editEvent(req, res, id);
  return send(res, 405, { error: 'Method not allowed' });
});

/** Everything the client needs to render the event in one round-trip. */
async function getSnapshot(res, id) {
  const { data: event } = await db()
    .from('events')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!event) return send(res, 404, { error: 'Event not found.' });

  const [{ data: days }, { data: participants }] = await Promise.all([
    db().from('event_days').select('day').eq('event_id', id).order('day'),
    db().from('participants').select('id, name').eq('event_id', id).order('id'),
  ]);

  const ids = (participants || []).map((p) => p.id);
  let availability = [];
  if (ids.length) {
    const { data: avail } = await db()
      .from('availability')
      .select('participant_id, day, start_min')
      .in('participant_id', ids);
    availability = avail || [];
  }

  return send(res, 200, {
    event: {
      id: event.id,
      title: event.title,
      adminName: event.admin_name,
      weekdayStartMin: event.weekday_start_min,
      weekdayEndMin: event.weekday_end_min,
      weekendStartMin: event.weekend_start_min,
      weekendEndMin: event.weekend_end_min,
    },
    days: (days || []).map((d) => d.day),
    participants: participants || [],
    availability,
  });
}

/** Admin-only: update title and core time windows. */
async function editEvent(req, res, id) {
  const body = await readBody(req);
  const event = await requireAdmin(id, body.name);
  if (!event) return send(res, 403, { error: 'Only the event admin can do that.' });

  const patch = {};
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim();
  if ('weekdayStartMin' in body) patch.weekday_start_min = clamp(body.weekdayStartMin, event.weekday_start_min);
  if ('weekdayEndMin' in body) patch.weekday_end_min = clamp(body.weekdayEndMin, event.weekday_end_min);
  if ('weekendStartMin' in body) patch.weekend_start_min = clamp(body.weekendStartMin, event.weekend_start_min);
  if ('weekendEndMin' in body) patch.weekend_end_min = clamp(body.weekendEndMin, event.weekend_end_min);

  // Guard against inverted windows.
  const wdS = patch.weekday_start_min ?? event.weekday_start_min;
  const wdE = patch.weekday_end_min ?? event.weekday_end_min;
  const weS = patch.weekend_start_min ?? event.weekend_start_min;
  const weE = patch.weekend_end_min ?? event.weekend_end_min;
  if (wdE <= wdS || weE <= weS) {
    return send(res, 400, { error: 'End time must be after start time.' });
  }

  if (Object.keys(patch).length) {
    const { error } = await db().from('events').update(patch).eq('id', id);
    if (error) return send(res, 500, { error: error.message });
  }
  return send(res, 200, { ok: true });
}
