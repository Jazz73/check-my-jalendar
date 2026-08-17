import { db, send, readBody, cleanName, withErrors } from '../../../lib/db.js';

// Name-only "login": first use of a name in an event claims it, later uses
// return the same participant. Case-insensitive match.
export default withErrors(async function handler(req, res) {
  const id = req.query.id;
  if (!id) return send(res, 400, { error: 'Missing event id.' });
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const body = await readBody(req);
  const name = cleanName(body.name);
  if (!name) return send(res, 400, { error: 'Enter a name.' });

  const { data: event } = await db()
    .from('events')
    .select('id, admin_name')
    .eq('id', id)
    .maybeSingle();
  if (!event) return send(res, 404, { error: 'Event not found.' });

  // Look for an existing participant (case-insensitive).
  const { data: existing } = await db()
    .from('participants')
    .select('id, name')
    .eq('event_id', id)
    .ilike('name', name)
    .maybeSingle();

  let participant = existing;
  if (!participant) {
    const { data: inserted, error } = await db()
      .from('participants')
      .insert({ event_id: id, name })
      .select('id, name')
      .single();
    if (error) {
      // Likely a race on the unique index; re-fetch.
      const { data: retry } = await db()
        .from('participants')
        .select('id, name')
        .eq('event_id', id)
        .ilike('name', name)
        .maybeSingle();
      if (!retry) return send(res, 500, { error: error.message });
      participant = retry;
    } else {
      participant = inserted;
    }
  }

  const isAdmin =
    name.toLowerCase() === cleanName(event.admin_name).toLowerCase();

  return send(res, 200, { participant, isAdmin });
});
