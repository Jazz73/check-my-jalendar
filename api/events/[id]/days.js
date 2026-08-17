import { db, send, readBody, requireAdmin, withErrors } from '../../../lib/db.js';

// Admin-only: add or remove a day from the event.
export default withErrors(async function handler(req, res) {
  const id = req.query.id;
  if (!id) return send(res, 400, { error: 'Missing event id.' });
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  const body = await readBody(req);
  const event = await requireAdmin(id, body.name);
  if (!event) return send(res, 403, { error: 'Only the event admin can do that.' });

  const day = String(body.day || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return send(res, 400, { error: 'Provide a day as YYYY-MM-DD.' });
  }

  if (req.method === 'POST') {
    const { error } = await db()
      .from('event_days')
      .upsert({ event_id: id, day }, { onConflict: 'event_id,day', ignoreDuplicates: true });
    if (error) return send(res, 500, { error: error.message });
  } else {
    // Remove the day and any availability recorded for it in this event.
    const { data: parts } = await db()
      .from('participants')
      .select('id')
      .eq('event_id', id);
    const pids = (parts || []).map((p) => p.id);
    if (pids.length) {
      await db().from('availability').delete().in('participant_id', pids).eq('day', day);
    }
    const { error } = await db()
      .from('event_days')
      .delete()
      .eq('event_id', id)
      .eq('day', day);
    if (error) return send(res, 500, { error: error.message });
  }

  return send(res, 200, { ok: true });
});
