// ============================================================================
// AGENTIC PROPOSAL ENGINE — with Human-in-the-Loop Approval
// ============================================================================
// When APPROVAL_MODE=true:
//   Agent renders PDF → emails OWNER for review → sends Telegram with
//   approval link → stores pending proposal → waits for human approval
//
// When APPROVAL_MODE is not set or false:
//   Agent auto-sends to visitor as before (no change to default flow)
// ============================================================================

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const crypto = require('crypto');

// ── In-memory pending proposals store ──────────────────────────────────────
// Key: proposal ID, Value: { pdf, visitor email, lead summary, conversation, etc. }
// For production at scale, use Supabase. For low volume this is fine.
const pendingProposals = {};

// Shared exports are attached at the bottom of the file

// ── Tool definitions for Claude ─────────────────────────────────────────────

const CORE_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'render_proposal_pdf',
      description: 'Renders a branded proposal PDF. Returns base64-encoded PDF data.',
      parameters: {
        type: 'object',
        properties: {
          company_name: { type: 'string', description: 'The prospect company name' },
          contact_name: { type: 'string', description: 'The prospect contact name' },
          sections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                heading: { type: 'string' },
                body: { type: 'string' },
              },
              required: ['heading', 'body'],
            },
            description: 'Proposal sections, each with a heading and body text',
          },
        },
        required: ['company_name', 'contact_name', 'sections'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_email',
      description: 'Sends an email with optional PDF attachment. In approval mode, this sends to the OWNER for review — not the visitor.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string', description: 'Email subject line' },
          body: { type: 'string', description: 'Email body text (plain text)' },
          attach_pdf: { type: 'boolean', description: 'Whether to attach the proposal PDF' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'alert_owner',
      description: 'Sends a Telegram alert to the owner with lead summary and proposal PDF.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Alert message text including lead score (HIGH/MEDIUM/LOW) and approval URL if in approval mode' },
        },
        required: ['message'],
      },
    },
  },
];

const STORE_LEAD_TOOL = {
  type: 'function',
  function: {
    name: 'store_lead',
    description: 'Stores the lead in the CRM database with score and conversation data.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Contact name' },
        company: { type: 'string', description: 'Company name' },
        email: { type: 'string', description: 'Contact email' },
        industry: { type: 'string', description: 'Company industry' },
        challenge: { type: 'string', description: 'Their main challenge (1-2 sentences)' },
        budget: { type: 'string', description: 'Budget range mentioned' },
        score: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'], description: 'Lead score based on triage rules' },
        status: { type: 'string', description: 'Lead status, e.g. proposal_sent or pending_approval' },
      },
      required: ['name', 'company', 'email', 'score', 'status'],
    },
  },
};

function getTools() {
  const tools = [...CORE_TOOLS];
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    tools.push(STORE_LEAD_TOOL);
  }
  return tools;
}

// ── PDF text sanitizer ──────────────────────────────────────────────────────

function sanitizeForPdf(text) {
  if (!text) return '';
  return text
    .replace(/₹/g, 'INR ')
    .replace(/€/g, 'EUR ')
    .replace(/£/g, 'GBP ')
    .replace(/[\u2013\u2014\u2015]/g, '-')
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2039\u203A]/g, "'")
    .replace(/[\u00AB\u00BB]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u00A0\u2002\u2003\u2007\u202F]/g, ' ')
    .replace(/[\u2022\u2023\u25E6\u2043]/g, '-')
    .replace(/\u2713/g, '[x]')
    .replace(/\u2717/g, '[ ]')
    .replace(/\u00D7/g, 'x')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

// ── Tool implementations ────────────────────────────────────────────────────

let proposalPdfBase64 = null;

const proposalPdfBase64Ref = { current: null };

async function renderProposalPdf({ company_name, contact_name, sections }) {
  company_name = sanitizeForPdf(company_name);
  contact_name = sanitizeForPdf(contact_name);
  sections = sections.map(s => ({
    heading: sanitizeForPdf(s.heading),
    body: sanitizeForPdf(s.body),
  }));

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const brandPrimary = rgb(0.004, 0.227, 0.169);
  const brandAccent = rgb(0.784, 0.663, 0.431);
  const black = rgb(0.1, 0.1, 0.1);
  const gray = rgb(0.35, 0.35, 0.35);

  const cover = pdf.addPage([612, 792]);
  cover.drawRectangle({ x: 0, y: 692, width: 612, height: 100, color: brandPrimary });
  cover.drawText('EDRA', { x: 50, y: 732, size: 22, font: fontBold, color: rgb(1, 1, 1) });
  cover.drawText('ESG Certification Readiness Index | Founded by Preyanka Jain', { x: 50, y: 710, size: 12, font, color: rgb(0.8, 0.8, 0.8) });
  cover.drawText('PROPOSAL', { x: 50, y: 600, size: 36, font: fontBold, color: brandPrimary });
  cover.drawText(`Prepared for ${contact_name}`, { x: 50, y: 565, size: 16, font, color: black });
  cover.drawText(company_name, { x: 50, y: 542, size: 14, font, color: gray });
  cover.drawText(
    new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
    { x: 50, y: 510, size: 12, font, color: gray }
  );

  let y = 720;
  let page = pdf.addPage([612, 792]);
  const maxWidth = 500;

  function drawLine(text, options) {
    if (y < 60) { page = pdf.addPage([612, 792]); y = 720; }
    page.drawText(text, { x: 50, y, ...options });
    y -= options.lineHeight || 18;
  }

  for (const section of sections) {
    if (y < 120) { page = pdf.addPage([612, 792]); y = 720; }
    page.drawLine({ start: { x: 50, y: y + 20 }, end: { x: 120, y: y + 20 }, thickness: 2, color: brandAccent });
    drawLine(section.heading, { size: 16, font: fontBold, color: brandPrimary, lineHeight: 28 });

    const paragraphs = section.body.split('\n');
    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') { y -= 10; continue; }
      const words = paragraph.split(' ');
      let line = '';
      for (const word of words) {
        const testLine = line ? `${line} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, 11);
        if (width > maxWidth && line) { drawLine(line, { size: 11, font, color: black }); line = word; }
        else { line = testLine; }
      }
      if (line) { drawLine(line, { size: 11, font, color: black }); }
    }
    y -= 20;
  }

  const lastPage = pdf.getPages()[pdf.getPageCount() - 1];
  lastPage.drawText('EDRA | Preyanka Jain | GRESB Certified Individual | India - Working Globally', { x: 50, y: 30, size: 9, font, color: gray });

  const pdfBytes = await pdf.save();
  proposalPdfBase64 = Buffer.from(pdfBytes).toString('base64');
  proposalPdfBase64Ref.current = proposalPdfBase64;
  return { success: true, pages: pdf.getPageCount(), size_kb: Math.round(pdfBytes.length / 1024) };
}

async function sendEmail({ to, subject, body, attach_pdf }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' };

  const payload = {
    from: 'Preyanka Jain <onboarding@resend.dev>',
    to,
    subject,
    text: body,
  };

  if (attach_pdf && proposalPdfBase64) {
    payload.attachments = [{ filename: 'proposal.pdf', content: proposalPdfBase64 }];
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', err);
    return { success: false, error: `Resend API error: ${res.status}` };
  }

  const data = await res.json();
  return { success: true, email_id: data.id };
}

// sendEmail exported at bottom of file

async function storeLead(leadData) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return { success: false, error: 'Supabase not configured' };

  const row = {
    name: leadData.name || null, company: leadData.company || null,
    email: leadData.email || null, industry: leadData.industry || null,
    challenge: leadData.challenge || null, budget: leadData.budget || null,
    score: leadData.score || null, status: leadData.status || 'proposal_sent',
  };

  const res = await fetch(`${url}/rest/v1/leads`, {
    method: 'POST',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify(row),
  });

  if (!res.ok) { const err = await res.text(); console.error('Supabase error:', err); return { success: false, error: `Supabase error: ${res.status}` }; }
  return { success: true };
}

async function alertOwner({ message }) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return { success: false, error: 'Telegram not configured' };

  const textRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  });

  if (!textRes.ok) { const err = await textRes.text(); console.error('Telegram error:', err); return { success: false, error: `Telegram error: ${textRes.status}` }; }

  if (proposalPdfBase64) {
    const pdfBuffer = Buffer.from(proposalPdfBase64, 'base64');
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', new Blob([pdfBuffer], { type: 'application/pdf' }), 'proposal.pdf');
    formData.append('caption', 'Proposal PDF attached');
    await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, { method: 'POST', body: formData });
  }

  return { success: true };
}

async function executeTool(name, args) {
  switch (name) {
    case 'render_proposal_pdf': return renderProposalPdf(args);
    case 'send_email':          return sendEmail(args);
    case 'store_lead':          return storeLead(args);
    case 'alert_owner':         return alertOwner(args);
    default:                    return { error: `Unknown tool: ${name}` };
  }
}

// ── Agent system prompt builder ─────────────────────────────────────────────

function buildSystemPrompt(approvalMode, approvalUrl) {
  const base = `You are an AI agent acting on behalf of Preyanka Jain, founder of EDRA.

You have received intake data from a website visitor. Your job:
1. Write a personalized proposal in Preyanka's voice
2. Score the lead using the triage rules below
3. Use your tools to render the proposal as a PDF, handle delivery, store the lead, and alert Preyanka

## PREYANKA'S IDENTITY & VOICE
Preyanka Jain is a senior marketing and growth leader. She re-positioned Shyam Spectra from an ISP to a Network-as-a-Service (NaaS) provider and scaled the marketing, BDR, and SDR functions from 8 to 60 people across India. She is a GRESB Certified Individual based in India, working globally.

Voice: Direct, outcome-focused, no fluff. State the problem, then the solution. Short sentences. Confident but not arrogant. Like a senior consultant who has done this a thousand times and respects the reader's time. Never use caveats, disclaimers, or filler phrases.

## EDRA SERVICES

### ESG Readiness Scoring
Full EDRA score across Planes A (asset context), B (data quality), and C (performance readiness) — benchmarked against GRESB, ENERGY STAR, and LEED thresholds.

### Gap Identification
Every failing metric flagged with a specific reason code: coverage gaps below 75%, continuity bad-days exceeded, critical fields missing, structural errors.

### Remediation Planning
Targeted action plan for every identified gap. Data corrections, documentation templates, audit-ready formatting.

### Certification Readiness Reporting
Audit-grade output for GRESB submission, ENERGY STAR application, or board presentation. Full audit trail.

### Consulting Services (non-EDRA)
- SDR and Inside Sales team setup and process design
- Digital transformation through business excellence
- Account Management team setup with quarterly planning, data segmentation, and persona identification

## LEAD TRIAGE RULES

### HIGH — Must match at least 3 of:
- Role: Fund manager, asset owner, Head of ESG/Sustainability, GRESB submitter, or C-suite at a real estate firm
- Portfolio size: 10+ assets or multi-property fund
- Active certification pressure: Currently submitting (or failed) GRESB, ENERGY STAR, or LEED
- Specific pain identified: Data coverage gaps, failed submissions, audit trail issues, continuity problems
- Budget: Mentions INR 5L+ / $10K+ or says "budget approved" / "allocated" / "not a constraint"
- Timeline: Needs results within 1-3 months or references an upcoming submission deadline
Also HIGH if: SDR/BDR team build with 10+ hires, or digital transformation at 500+ employee enterprise
Automatic HIGH: GRESB deadline within 60 days, listed REIT or sovereign fund, known ESG consultancy domain

### MEDIUM — Matches at least 2 of:
- Role: ESG consultant, sustainability analyst, property manager, operations lead
- Portfolio size: 1-10 assets or single-fund scope
- Exploring certification for the first time or early-stage readiness
- Pain is real but not urgent
- Budget: Mentions a range but uncommitted
- Timeline: 3-6 months or "next cycle"

### LOW — Any of:
- Student, researcher, journalist, no real estate/ESG connection
- No assets under management
- Vague challenge with no operational need
- No budget signal
- Competitor research
- Solo freelancer wanting tips

## PROPOSAL STRUCTURE
Write 4-5 sections:
1. Understanding Your Challenge
2. Recommended Approach (reference Planes A/B/C, reason codes, remediation)
3. Proposed Engagement (service, scope, timeline)
4. Investment (pricing range based on scope)
5. Next Steps`;

  if (approvalMode) {
    return base + `

## APPROVAL MODE — ACTIVE
Human-in-the-loop approval is enabled. You MUST follow this modified flow:

1. Score the lead and write the proposal as usual
2. Call render_proposal_pdf to generate the PDF
3. DO NOT call send_email to the visitor. Instead:
   - Call send_email to the OWNER at ${process.env.OWNER_EMAIL || 'priyankachhalani@gmail.com'} with subject "PROPOSAL FOR REVIEW: [Company Name]" and the PDF attached. The email body should include the lead summary (name, company, challenge, score).
4. Call alert_owner with a message that says:
   "PENDING APPROVAL - [Score] Lead
   Company: [company]
   Contact: [name] ([email])
   Challenge: [1-line summary]
   Score: [HIGH/MEDIUM/LOW]

   Review & approve: ${approvalUrl}"
5. If the store_lead tool is available, call it with status "pending_approval" (not "proposal_sent")
6. Do NOT send the proposal to the visitor — that happens after Preyanka approves it`;
  }

  return base + `

## INSTRUCTIONS
- Write the proposal in Preyanka's voice — direct, personal, specific
- Score the lead using the triage rules (HIGH/MEDIUM/LOW)
- Call render_proposal_pdf with the proposal sections
- Call send_email with a warm, short email and the PDF attached to the VISITOR
- If the store_lead tool is available, call it with all lead data and score
- Call alert_owner with a summary: company, contact, challenge, score, and one line on why
- For LOW leads: still call alert_owner but skip render_proposal_pdf and send_email
- You decide the order. You can call multiple tools at once if they are independent.`;
}

// ── Agent loop (reusable for revisions) ─────────────────────────────────────

async function runAgentLoop(systemPrompt, userMessage, tools, req) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  proposalPdfBase64 = null;
  module.exports.proposalPdfBase64Ref.current = null;

  let messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const results = { proposal: false, email: false, stored: false, alerted: false };

  for (let turn = 1; turn <= 5; turn++) {
    console.log(`Agent turn ${turn}...`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req?.headers?.host ? `https://${req.headers.host}` : 'http://localhost:3000',
      },
      body: JSON.stringify({ model: 'anthropic/claude-sonnet-4.6', messages, tools, max_tokens: 4096 }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Agent OpenRouter error:', err);
      return { error: 'Agent API call failed', details: err };
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice) break;

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      console.log(`Agent turn ${turn}... Agent completed.`);
      break;
    }

    const toolNames = assistantMessage.tool_calls.map(tc => tc.function.name);
    console.log(`Agent turn ${turn}... Claude called ${toolNames.length} tool(s): ${toolNames.join(', ')}`);

    for (const toolCall of assistantMessage.tool_calls) {
      let args;
      try { args = JSON.parse(toolCall.function.arguments); }
      catch (e) {
        messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify({ error: 'Failed to parse arguments' }) });
        continue;
      }

      const result = await executeTool(toolCall.function.name, args);

      if (toolCall.function.name === 'render_proposal_pdf' && result.success) results.proposal = true;
      if (toolCall.function.name === 'send_email' && result.success) results.email = true;
      if (toolCall.function.name === 'store_lead' && result.success) results.stored = true;
      if (toolCall.function.name === 'alert_owner' && result.success) results.alerted = true;

      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) });
    }
  }

  return { success: true, results };
}

// Exports attached after handler definition below

// ── Main handler ────────────────────────────────────────────────────────────

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { conversation, intakeData } = req.body;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured' });

  if (!conversation && !intakeData) {
    return res.status(400).json({ error: 'conversation or intakeData required' });
  }

  const approvalMode = process.env.APPROVAL_MODE === 'true';
  const proposalId = crypto.randomUUID();
  const baseUrl = req.headers?.host ? `https://${req.headers.host}` : 'http://localhost:3000';
  const approvalUrl = `${baseUrl}/api/approve-proposal?id=${proposalId}`;

  const tools = getTools();
  const supabaseEnabled = tools.some(t => t.function?.name === 'store_lead');
  console.log(`Agent starting with ${tools.length} tools${supabaseEnabled ? ' (Supabase enabled)' : ''}${approvalMode ? ' [APPROVAL MODE]' : ''}`);

  const intakeContext = intakeData
    ? `VISITOR INTAKE DATA:\n${JSON.stringify(intakeData, null, 2)}`
    : `CONVERSATION TRANSCRIPT:\n${conversation.map(m => `${m.role}: ${m.content}`).join('\n')}`;

  const systemPrompt = buildSystemPrompt(approvalMode, approvalUrl);
  const userMessage = `${intakeContext}\n\nPlease write a personalized proposal, score this lead, and use your tools to ${approvalMode ? 'send it for approval' : 'send everything'}.`;

  const result = await runAgentLoop(systemPrompt, userMessage, tools, req);

  if (result.error) {
    return res.status(502).json(result);
  }

  // If approval mode, store the pending proposal
  if (approvalMode && proposalPdfBase64) {
    pendingProposals[proposalId] = {
      id: proposalId,
      pdf: proposalPdfBase64,
      intakeData: intakeData || null,
      conversation: conversation || null,
      intakeContext,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    console.log(`Pending proposal stored: ${proposalId}`);
    result.results.proposalId = proposalId;
    result.results.approvalUrl = approvalUrl;
  }

  console.log('Agent pipeline complete:', result.results);
  return res.json(result);
};

// ── Export: handler as default, shared state as properties ──────────────────
// Vercel uses `module.exports` as the serverless handler
// approve-proposal.js accesses shared state via `require('./generate-proposal').xxx`
module.exports = handler;
module.exports.pendingProposals = pendingProposals;
module.exports.proposalPdfBase64Ref = proposalPdfBase64Ref;
module.exports.sendEmail = sendEmail;
module.exports.runAgentLoop = runAgentLoop;
module.exports.buildSystemPrompt = buildSystemPrompt;
module.exports.getTools = getTools;
