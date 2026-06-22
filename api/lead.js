// ============================================================================
// TIME COMPRESSION SIMULATOR — LEAD HANDLER
// ============================================================================
// Receives a POST from the lead-capture gate on /time-compression, validates
// it server-side (defense-in-depth against bots that bypass the client-side
// gate), STORES the lead in Supabase (table `leads`), and notifies
// p.jain@edraindex.com via Resend.
//
// Both sinks are best-effort and independent: if the DB insert fails we still
// email (so a lead is never silently lost), and vice-versa. Returns 200 +
// { ok: true } when at least one sink succeeded; the client reveals the
// visitor's number regardless (the fetch is fire-and-forget).
//
// Env vars (set on the my-site Vercel project):
//   SUPABASE_URL                — e.g. https://abcd1234.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   — service_role key (server-only, never client)
//   RESEND_API_KEY              — already configured for contact-form
// ============================================================================

const NOTIFY_TO = ['p.jain@edraindex.com'];

// Supabase project "time compression June-July 2026" (ref nlvkrbzmrtsfjgtcbtye).
// We use the ANON key with an INSERT-ONLY row-level-security policy on the
// `leads` table: anon may insert, nobody may read. The anon key is designed to
// be publishable, so embedding it here (with env override) is safe and means no
// Vercel env vars are required. The service_role key is intentionally NOT used.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nlvkrbzmrtsfjgtcbtye.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sdmtyYnptcnRzZmpndGNidHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwOTg0ODUsImV4cCI6MjA5NzY3NDQ4NX0.Ebyz_6p4LqMySvg_FosDcMdga6bUnvgmAvuqT5mMTew';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Kept in sync with the client gate's free-provider list.
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.in', 'yahoo.fr', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.co.in', 'outlook.com', 'outlook.fr', 'live.com', 'msn.com',
  'aol.com', 'aim.com', 'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me', 'pm.me', 'mail.com', 'gmx.com', 'gmx.net',
  'yandex.com', 'yandex.ru', 'rediffmail.com', 'rediff.com', 'fastmail.com', 'fastmail.fm',
  'tutanota.com', 'tuta.io', 'zoho.com', 'hey.com', 'qq.com', '163.com', '126.com', 'duck.com',
]);

function isPersonalEmail(s) {
  const at = s.indexOf('@');
  if (at < 0) return false;
  return PERSONAL_EMAIL_DOMAINS.has(s.slice(at + 1).trim().toLowerCase());
}

function clean(v, max = 500) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

// Coerce to a bounded integer or null.
function intOrNull(v, min = -1000, max = 100000) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function validate(b) {
  const errors = [];
  const name = clean(b.name, 120);
  const email = clean(b.email, 200).toLowerCase();

  if (name.length < 2) errors.push('name');
  if (!EMAIL_RE.test(email) || isPersonalEmail(email)) errors.push('email');

  // Result + context (all optional / best-effort — the gate is the gate).
  const r = b.result || {};
  const lead = {
    name,
    email,
    role: clean(b.role || b.icp, 40),
    role_label: clean(b.roleLabel, 60),
    answers: Array.isArray(b.answers) ? b.answers.slice(0, 6).map((x) => intOrNull(x, 0, 10)) : null,
    answer_labels: Array.isArray(b.answerLabels) ? b.answerLabels.slice(0, 6).map((x) => clean(x, 60)) : null,
    index_pct: intOrNull(r.index != null ? r.index : b.index, 0, 100),
    reclaimed_weeks: intOrNull(r.reclaimed != null ? r.reclaimed : b.reclaimed_weeks),
    baseline_weeks: intOrNull(r.baseline != null ? r.baseline : b.baseline_weeks),
    edra_weeks: intOrNull(r.edra != null ? r.edra : b.edra_weeks),
    start_score: intOrNull(r.startScore != null ? r.startScore : b.start_score, 0, 100),
    start_band: clean(r.startBand || b.start_band, 60),
  };
  return { errors, lead };
}

// --- Sink 1: Supabase (PostgREST insert) ---------------------------------
async function insertSupabase(record) {
  const url = SUPABASE_URL;
  const key = SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('lead: Supabase URL / anon key not configured');
    return { success: false, error: 'supabase_not_configured' };
  }
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('lead: Supabase insert error:', res.status, err);
      return { success: false, error: `supabase_${res.status}` };
    }
    return { success: true };
  } catch (e) {
    console.error('lead: Supabase insert threw:', e);
    return { success: false, error: 'supabase_exception' };
  }
}

// --- Sink 2: Resend notification -----------------------------------------
function formatBody(lead, meta) {
  const ans = lead.answer_labels && lead.answer_labels.length
    ? lead.answer_labels.join('  /  ')
    : (lead.answers ? lead.answers.join(', ') : '(none)');
  return [
    'A new Time Compression Simulator lead was captured on edraindex.com/time-compression.',
    '',
    '— Lead —',
    `Name:            ${lead.name}`,
    `Work email:      ${lead.email}`,
    `Role / seat:     ${lead.role_label || lead.role || '(unspecified)'}`,
    '',
    '— Their result —',
    `Time compression: ${lead.index_pct != null ? lead.index_pct + '%' : '(n/a)'}`,
    `Reclaimed:        ${lead.reclaimed_weeks != null ? lead.reclaimed_weeks + ' weeks' : '(n/a)'}`,
    `Baseline → EDRA:  ${lead.baseline_weeks != null ? lead.baseline_weeks + 'w' : '?'} → ${lead.edra_weeks != null ? lead.edra_weeks + 'w' : '?'}`,
    `Starting band:    ${lead.start_band || '?'}${lead.start_score != null ? ' (' + lead.start_score + ')' : ''}`,
    `Answers:          ${ans}`,
    '',
    '— Meta —',
    `Submitted at:    ${meta.ts}`,
    `Source IP:       ${meta.ip || 'unknown'}`,
    `User-Agent:      ${meta.ua || 'unknown'}`,
    `Referer:         ${meta.referer || 'direct'}`,
    '',
    'Reply directly to this email — it will route to the lead.',
  ].join('\n');
}

async function notifyResend(lead, meta) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('lead: RESEND_API_KEY not configured');
    return { success: false, error: 'resend_not_configured' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'EDRA <notifications@edraindex.com>',
        to: NOTIFY_TO,
        subject: `New Time Compression lead — ${lead.name}${lead.role_label ? ' (' + lead.role_label + ')' : ''}`,
        text: formatBody(lead, meta),
        reply_to: lead.email,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('lead: Resend error:', res.status, err);
      return { success: false, error: `resend_${res.status}` };
    }
    return { success: true };
  } catch (e) {
    console.error('lead: Resend threw:', e);
    return { success: false, error: 'resend_exception' };
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const body = req.body || {};

  // Honeypot: the hidden "website" field is invisible to humans. Anything that
  // fills it is a bot — accept silently (so it can't tell it was blocked) and
  // drop without storing or emailing.
  if (clean(body.website)) {
    res.status(200).json({ ok: true, dropped: true });
    return;
  }

  const { errors, lead } = validate(body);
  if (errors.length) {
    res.status(400).json({ ok: false, error: 'validation_failed', fields: errors });
    return;
  }

  const meta = {
    ts: new Date().toISOString(),
    ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress,
    ua: req.headers['user-agent'],
    referer: req.headers['referer'] || req.headers['referrer'],
  };

  // DB record carries the lead, the meta, and a raw copy for safety.
  const record = {
    ...lead,
    ip: clean(meta.ip, 100),
    user_agent: clean(meta.ua, 400),
    referer: clean(meta.referer, 400),
    raw: body,
  };

  // Run both sinks; neither blocks the other.
  const [db, mail] = await Promise.all([insertSupabase(record), notifyResend(lead, meta)]);

  if (!db.success && !mail.success) {
    res.status(502).json({ ok: false, error: 'all_sinks_failed', db: db.error, mail: mail.error });
    return;
  }

  res.status(200).json({ ok: true, stored: db.success, notified: mail.success });
};
