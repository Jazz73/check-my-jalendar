// Shared helpers for check-my-jalendar (loaded by both pages).

export const HALF_HOUR = 30;

/** POST/PUT/DELETE/GET JSON against the API. Throws on non-2xx with the server message. */
export async function api(path, method = 'GET', body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

// ---- time helpers -------------------------------------------------------

/** minutes-from-midnight -> "6:00 PM" (24:00 -> "12:00 AM"). */
export function fmtTime(min) {
  const m = ((min % 1440) + 1440) % 1440;
  let h = Math.floor(m / 60);
  const mm = m % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
}

/** "6:00 – 6:30 PM" for a 30-min chunk starting at startMin. */
export function fmtRange(startMin, endMin) {
  return `${fmtTime(startMin)} – ${fmtTime(endMin)}`;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parse 'YYYY-MM-DD' as a local date (avoids UTC off-by-one). */
export function parseDay(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isWeekend(day) {
  const dow = parseDay(day).getDay();
  return dow === 0 || dow === 6;
}

/** 'Tue Aug 18' */
export function fmtDayShort(day) {
  const dt = parseDay(day);
  return `${DOW[dt.getDay()]} ${MON[dt.getMonth()]} ${dt.getDate()}`;
}

/** Parts for a compact stacked column header: { dow:'Tue', dom:18, mon:'Aug' }. */
export function dayParts(day) {
  const dt = parseDay(day);
  return { dow: DOW[dt.getDay()], dom: dt.getDate(), mon: MON[dt.getMonth()] };
}

/** Local YYYY-MM-DD for a Date (no UTC shift). */
export function isoDate(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Monday-of-week key for a 'YYYY-MM-DD' day, used to group days into weeks. */
export function weekKey(day) {
  const d = parseDay(day);
  const mondayOffset = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - mondayOffset);
  return isoDate(d);
}

/** Group a sorted day list into consecutive calendar weeks (Mon–Sun). */
export function groupWeeks(days) {
  const groups = [];
  let curKey = null;
  for (const day of days) {
    const k = weekKey(day);
    if (k !== curKey) {
      groups.push({ key: k, days: [] });
      curKey = k;
    }
    groups[groups.length - 1].days.push(day);
  }
  return groups;
}

/**
 * Given an event config + a day, return the list of 30-min chunk start
 * minutes to show, based on the weekday/weekend core window.
 */
export function slotsForDay(event, day) {
  const weekend = isWeekend(day);
  const start = weekend ? event.weekendStartMin : event.weekdayStartMin;
  const end = weekend ? event.weekendEndMin : event.weekdayEndMin;
  const out = [];
  for (let m = start; m < end; m += HALF_HOUR) out.push(m);
  return out;
}

// ---- identity (name-only login remembered per event) --------------------

export function rememberName(eventId, name) {
  try {
    localStorage.setItem(`cmj:name:${eventId}`, name);
  } catch {
    /* ignore */
  }
}

export function recallName(eventId) {
  try {
    return localStorage.getItem(`cmj:name:${eventId}`) || '';
  } catch {
    return '';
  }
}
