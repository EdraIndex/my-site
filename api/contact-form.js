// ============================================================================
// CONTACT FORM HANDLER
// ============================================================================
// Receives a POST from the homepage assessment-request form, validates it
// server-side (defense-in-depth against bots that bypass the client-side
// validation), and emails p.jain@edraindex.com, rachit@edraindex.com and
// p.jain@outsourcinghubindia.com
// via Resend with the lead details.
//
// Returns 200 + { ok: true } on success so the client can show the
// "Request Received" state.
// ============================================================================

const RECIPIENTS = ['p.jain@edraindex.com', 'rachit@edraindex.com', 'p.jain@outsourcinghubindia.com'];

// Landing-page bookings route to the chosen host's inbox. This is a CLOSED
// server-side enum — the client sends only a `book_with` key ('preyanka' |
// 'priyankar'), never a raw address, so it can't be turned into an open relay.
const BOOKING_ROUTES = {
  preyanka:  ['p.jain@edraindex.com'],
  priyankar: ['priyankar@outsourcinghubindia.com'],
};

// Sources where only name + work email are required (short on-site booking forms).
const LENIENT_SOURCES = new Set(['imn-danapoint', 'imn-sales']);

// The /imn-sales variant is a copy of the IMN landing page used by the sales team
// for their own outreach campaigns. Bookings from it go to the normal host route
// AND get CC'd to this inbox, so the team gets a copy of every lead they source.
const SALES_CC = 'sudhanshu@outsourcinghubindia.com';

// Same regex + personal-domain list as the client. Kept in sync intentionally.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.in', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.co.in',
  'outlook.com', 'live.com', 'msn.com',
  'aol.com', 'aim.com',
  'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'mail.com', 'gmx.com', 'gmx.net',
  'yandex.com', 'yandex.ru',
  'rediffmail.com', 'rediff.com',
  'fastmail.com', 'fastmail.fm',
  'tutanota.com', 'tuta.io',
]);

function isPersonalEmail(s) {
  const at = s.indexOf('@');
  if (at < 0) return false;
  return PERSONAL_EMAIL_DOMAINS.has(s.slice(at + 1).trim().toLowerCase());
}

// Trim + cap length so a malicious actor can't post a 10MB string.
function clean(v, max = 500) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

function validate(b, lenient = false) {
  const errors = [];
  const name = clean(b.name, 120);
  const email = clean(b.email, 200);
  const company = clean(b.company, 200);
  const portfolio_type = clean(b.portfolio_type, 60);
  const asset_count = clean(b.asset_count, 80);
  const objective = clean(b.objective, 60);
  const message = clean(b.message, 4000);

  if (name.length < 2) errors.push('name');
  if (!EMAIL_RE.test(email) || isPersonalEmail(email)) errors.push('email');
  // Short booking forms (e.g. the IMN landing page) only require name + work email.
  if (!lenient) {
    if (company.length < 2) errors.push('company');
    if (portfolio_type.length < 1) errors.push('portfolio_type');
    if (asset_count.length < 1) errors.push('asset_count');
    if (objective.length < 1) errors.push('objective');
  }

  return { errors, lead: { name, email, company, portfolio_type, asset_count, objective, message } };
}

async function sendEmail({ to, subject, body, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('contact-form: RESEND_API_KEY not configured');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  // Sends from notifications@edraindex.com (edraindex.com verified in Resend
  // 2026-05-13 via DKIM + send-subdomain SPF/MX). Reply-To routes replies
  // straight to the visitor so we can respond from p.jain/rachit's real M365
  // mailboxes.
  const payload = {
    from: 'EDRA <notifications@edraindex.com>',
    to,
    subject,
    text: body,
    reply_to: replyTo,
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('contact-form: Resend error:', err);
    return { success: false, error: `Resend ${res.status}` };
  }

  const data = await res.json();
  return { success: true, email_id: data.id };
}

function formatBody(lead, meta, opts = {}) {
  if (opts.lenient) {
    return [
      'A new on-site meeting booking was submitted from the EDRA+ IMN landing page.',
      '',
      '— Lead —',
      `Name:        ${lead.name}`,
      `Work email:  ${lead.email}`,
      `Company:     ${lead.company || '(not given)'}`,
      '',
      '— Booking —',
      lead.message || '(none)',
      '',
      '— Meta —',
      `Submitted:   ${meta.ts}`,
      `Source IP:   ${meta.ip || 'unknown'}`,
      `Referer:     ${meta.referer || 'direct'}`,
      '',
      'Reply directly to this email — it routes to the lead.',
    ].join('\n');
  }
  return [
    'A new assessment request was submitted on edraindex.com.',
    '',
    '— Lead —',
    `Name:           ${lead.name}`,
    `Work email:     ${lead.email}`,
    `Company:        ${lead.company}`,
    `Portfolio:      ${lead.portfolio_type}`,
    `# assets:       ${lead.asset_count}`,
    `Objective:      ${lead.objective}`,
    '',
    '— Message —',
    lead.message || '(none)',
    '',
    '— Meta —',
    `Submitted at:   ${meta.ts}`,
    `Source IP:      ${meta.ip || 'unknown'}`,
    `User-Agent:     ${meta.ua || 'unknown'}`,
    `Referer:        ${meta.referer || 'direct'}`,
    '',
    'Reply directly to this email — it will route to the lead.',
  ].join('\n');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  const body = req.body || {};
  const source = clean(body.source, 60).toLowerCase();
  const bookWith = clean(body.book_with, 40).toLowerCase();
  const lenient = LENIENT_SOURCES.has(source);
  const { errors, lead } = validate(body, lenient);
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

  const recipients = ((lenient && BOOKING_ROUTES[bookWith]) ? BOOKING_ROUTES[bookWith] : RECIPIENTS).slice();
  if (source === 'imn-sales' && !recipients.includes(SALES_CC)) recipients.push(SALES_CC);
  const subject = lenient
    ? `New IMN Dana Point booking — ${lead.name}${lead.company ? ' · ' + lead.company : ''}`
    : source === 'sample-report'
      ? `New Sample Report download — ${lead.company}`
      : `New EDRA assessment request — ${lead.company}`;

  const result = await sendEmail({
    to: recipients,
    subject,
    body: formatBody(lead, meta, { lenient, source }),
    replyTo: lead.email,
  });

  if (!result.success) {
    res.status(502).json({ ok: false, error: 'email_send_failed' });
    return;
  }

  // Sample-report downloads: email the requester their copy (best-effort — a
  // failure here must not fail the request, since the page already unlocked
  // the in-browser download on the 200 below).
  if (source === 'sample-report') {
    await sendEmail({
      to: [lead.email],
      subject: 'Your EDRA sample report',
      body: [
        `Hi ${lead.name.split(' ')[0] || 'there'},`,
        '',
        'Thanks for your interest in EDRA. Here is the sample report you requested —',
        'a full ESG Data Readiness Assessment of a real (anonymised) 23-asset portfolio:',
        '',
        'https://edraindex.com/reports/sample-report.pdf',
        '',
        'It walks through exactly how we score a portfolio\'s data — coverage, temporal',
        'continuity and governance — against the thresholds a framework submission has to clear.',
        '',
        'If you\'d like to see what your own portfolio looks like through the same rubric, just',
        'reply to this email and we\'ll set up a short walkthrough.',
        '',
        'Priyanka Jain',
        'EDRA · a product of Outsourcing Hub India',
        'edraindex.com',
      ].join('\n'),
      replyTo: 'p.jain@edraindex.com',
    });
  }

  res.status(200).json({ ok: true });
};
