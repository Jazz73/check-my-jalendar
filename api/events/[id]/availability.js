import { db, send, readBody, cleanName, withErrors } from '../../../lib/db.js';

const HALF_HOUR = 30;
const DAY_MIN = 24 * 60;

// Replace a participant's entire selection set. Idempotent: delete then insert.
// Body: { name, slots: [{ day: 'YYYY-MM-DD', startMin: 1020 }, ...] }
export default withErrors(async function handler(req, res) {
  const id = req.query.id;
  if (!id) return send(res, 400, { error: 'Missing event id.' });
  if (req.method !== 'PUT') return send(res, 405, { error: 'Method not allowed' });

  const body = await readBody(req);
  const name = cleanName(body.name);
  if (!name) return send(res, 400, { error: 'Missing name.' });

  const { data: participant } = await db()
    .from('participants')
    .select('id')
    .eq('event_id', id)
    .ilike('name', name)
    .maybeSingle();
  if (!participant) return send(res, 404, { error: 'Join the event first.' });

  // Validate + dedupe incoming slots.
  const seen = new Set();
  const rows = [];
  for (const s of Array.isArray(body.slots) ? body.slots : []) {
    const day = String(s.day || '');
    const startMin = Number(s.startMin);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (!Number.isInteger(startMin) || startMin < 0 || startMin >= DAY_MIN) continue;
    if (startMin % HALF_HOUR !== 0) continue;
    const key = `${day}|${startMin}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ participant_id: participant.id, day, start_min: startMin });
  }

  const delRes = await db()
    .from('availability')
    .delete()
    .eq('participant_id', participant.id);
  if (delRes.error) return send(res, 500, { error: delRes.error.message });

  if (rows.length) {
    const insRes = await db().from('availability').insert(rows);
    if (insRes.error) return send(res, 500, { error: insRes.error.message });
  }

  return send(res, 200, { ok: true, count: rows.length });
});
