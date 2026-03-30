// ============================================================================
// HUMAN-IN-THE-LOOP APPROVAL ENDPOINT
// ============================================================================
// GET  ?id=xxx  → Shows approval page with lead summary + Approve/Revise buttons
// POST ?id=xxx  → action=approve: sends proposal to visitor
//                  action=revise + instructions: re-runs agent, shows new version
// ============================================================================

const generateProposal = require('./generate-proposal');
const { pendingProposals, sendEmail, runAgentLoop, buildSystemPrompt, getTools, proposalPdfBase64Ref } = generateProposal;

function getBaseUrl(req) {
  return req.headers?.host ? `https://${req.headers.host}` : 'http://localhost:3000';
}

async function alertOwnerConfirmation(message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
}

function renderApprovalPage(proposal, baseUrl, message) {
  const data = proposal.intakeData || {};
  const statusClass = proposal.status === 'approved' ? 'approved' : proposal.status === 'revised' ? 'revised' : 'pending';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EDRA — Proposal Approval</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0A0A0A; color: #E0E0E0; min-height: 100vh; padding: 40px 20px; }
    .container { max-width: 640px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
    .header h1 { font-size: 1.5rem; color: #FFF; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 100px; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
    .badge.pending { background: rgba(255,180,0,0.15); color: #FFB400; border: 1px solid rgba(255,180,0,0.3); }
    .badge.approved { background: rgba(22,211,202,0.15); color: #16D3CA; border: 1px solid rgba(22,211,202,0.3); }
    .badge.revised { background: rgba(100,100,255,0.15); color: #8888FF; border: 1px solid rgba(100,100,255,0.3); }
    .card { background: #161616; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 28px; margin-bottom: 20px; }
    .card h3 { color: #FFF; font-size: 1rem; margin-bottom: 16px; }
    .field { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.9rem; }
    .field:last-child { border-bottom: none; }
    .field .label { color: #888; }
    .field .value { color: #FFF; font-weight: 500; text-align: right; max-width: 60%; }
    .msg { padding: 16px; border-radius: 8px; margin-bottom: 20px; font-size: 0.9rem; }
    .msg.success { background: rgba(22,211,202,0.1); border: 1px solid rgba(22,211,202,0.2); color: #16D3CA; }
    .msg.info { background: rgba(100,100,255,0.1); border: 1px solid rgba(100,100,255,0.2); color: #8888FF; }
    .actions { display: flex; gap: 12px; margin-bottom: 24px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 14px 28px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; width: 100%; }
    .btn-approve { background: #16D3CA; color: #0A0A0A; }
    .btn-approve:hover { background: #0FA89F; }
    .btn-approve:disabled { opacity: 0.5; cursor: not-allowed; }
    .revise-section { margin-top: 8px; }
    .revise-section textarea { width: 100%; background: #1C1C1C; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; color: #FFF; font-family: inherit; font-size: 0.9rem; min-height: 100px; resize: vertical; outline: none; }
    .revise-section textarea:focus { border-color: #16D3CA; }
    .btn-revise { background: transparent; color: #8888FF; border: 1px solid rgba(100,100,255,0.3); margin-top: 12px; }
    .btn-revise:hover { background: rgba(100,100,255,0.1); }
    .pdf-link { display: inline-flex; align-items: center; gap: 8px; color: #16D3CA; font-size: 0.85rem; text-decoration: none; margin-top: 8px; }
    .pdf-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>EDRA Proposal Review</h1>
      <span class="badge ${statusClass}">${proposal.status}</span>
    </div>

    ${message ? `<div class="msg ${proposal.status === 'approved' ? 'success' : 'info'}">${message}</div>` : ''}

    <div class="card">
      <h3>Lead Summary</h3>
      <div class="field"><span class="label">Company</span><span class="value">${data.company || 'N/A'}</span></div>
      <div class="field"><span class="label">Contact</span><span class="value">${data.email || 'N/A'}</span></div>
      <div class="field"><span class="label">Challenge</span><span class="value">${data.challenge || 'N/A'}</span></div>
      <div class="field"><span class="label">Budget</span><span class="value">${data.budget || 'N/A'}</span></div>
      <div class="field"><span class="label">Created</span><span class="value">${new Date(proposal.createdAt).toLocaleString()}</span></div>
    </div>

    ${proposal.status === 'pending' || proposal.status === 'revised' ? `
    <form method="POST" action="${baseUrl}/api/approve-proposal?id=${proposal.id}">
      <input type="hidden" name="action" value="approve" />
      <div class="actions">
        <button type="submit" class="btn btn-approve">Approve &amp; Send to Visitor</button>
      </div>
    </form>

    <div class="card revise-section">
      <h3>Request Changes</h3>
      <form method="POST" action="${baseUrl}/api/approve-proposal?id=${proposal.id}">
        <input type="hidden" name="action" value="revise" />
        <textarea name="instructions" placeholder="Describe what should change in the proposal..."></textarea>
        <button type="submit" class="btn btn-revise">Revise Proposal</button>
      </form>
    </div>
    ` : ''}

    ${proposal.status === 'approved' ? '<div class="msg success">Proposal has been sent to the visitor.</div>' : ''}
  </div>
</body>
</html>`;
}

module.exports = async function handler(req, res) {
  const proposalId = req.query?.id || new URL(req.url, 'http://localhost').searchParams.get('id');

  if (!proposalId || !pendingProposals[proposalId]) {
    return res.status(404).send('<!DOCTYPE html><html><body style="font-family:sans-serif;background:#0A0A0A;color:#FFF;padding:60px;text-align:center;"><h1>Proposal not found</h1><p style="color:#888;">This proposal link may have expired or is invalid.</p></body></html>');
  }

  const proposal = pendingProposals[proposalId];
  const baseUrl = getBaseUrl(req);

  // ── GET: Show approval page ──
  if (req.method === 'GET') {
    return res.setHeader('Content-Type', 'text/html').status(200).send(renderApprovalPage(proposal, baseUrl, null));
  }

  // ── POST: Handle approve or revise ──
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse form body (URL-encoded from HTML form)
  let action, instructions;
  if (typeof req.body === 'string') {
    const params = new URLSearchParams(req.body);
    action = params.get('action');
    instructions = params.get('instructions');
  } else {
    action = req.body?.action;
    instructions = req.body?.instructions;
  }

  // ── APPROVE: Send proposal to visitor ──
  if (action === 'approve') {
    const data = proposal.intakeData || {};
    const visitorEmail = data.email;

    if (!visitorEmail) {
      return res.setHeader('Content-Type', 'text/html').status(200).send(
        renderApprovalPage(proposal, baseUrl, 'No visitor email found in intake data. Cannot send.')
      );
    }

    // Restore PDF state and send to visitor
    const prevPdf = proposalPdfBase64Ref.current;
    proposalPdfBase64Ref.current = proposal.pdf;

    const emailResult = await sendEmail({
      to: visitorEmail,
      subject: `Your EDRA Proposal — ${data.company || 'Custom Engagement'}`,
      body: `Hi,\n\nThank you for your interest in EDRA. Please find your personalized proposal attached.\n\nI've reviewed it personally and believe it addresses your specific situation. If you'd like to discuss any part of it, just reply to this email.\n\nBest,\nPreyanka Jain\nEDRA | GRESB Certified Individual`,
      attach_pdf: true,
    });

    // Restore previous PDF state
    proposalPdfBase64Ref.current = prevPdf;

    proposal.status = 'approved';

    // Telegram confirmation
    await alertOwnerConfirmation(`APPROVED — Proposal sent to ${visitorEmail} (${data.company || 'Unknown company'})`);

    console.log(`Proposal ${proposalId} approved and sent to ${visitorEmail}:`, emailResult);
    return res.setHeader('Content-Type', 'text/html').status(200).send(
      renderApprovalPage(proposal, baseUrl, `Proposal approved and sent to ${visitorEmail}.`)
    );
  }

  // ── REVISE: Re-run agent with revision instructions ──
  if (action === 'revise') {
    if (!instructions || !instructions.trim()) {
      return res.setHeader('Content-Type', 'text/html').status(200).send(
        renderApprovalPage(proposal, baseUrl, 'Please provide revision instructions.')
      );
    }

    console.log(`Revising proposal ${proposalId} with instructions: ${instructions}`);

    const tools = getTools();
    const approvalUrl = `${baseUrl}/api/approve-proposal?id=${proposalId}`;
    const systemPrompt = buildSystemPrompt(true, approvalUrl);

    const revisionMessage = `${proposal.intakeContext}

REVISION REQUEST FROM PREYANKA:
The previous proposal needs changes. Here are the instructions:
${instructions}

Please write a revised proposal addressing these changes, render a new PDF, and send it to the owner for re-review at ${process.env.OWNER_EMAIL || 'priyankachhalani@gmail.com'}. Alert on Telegram that this is a REVISED proposal pending re-approval. Include the approval URL: ${approvalUrl}`;

    const result = await runAgentLoop(systemPrompt, revisionMessage, tools, req);

    if (proposalPdfBase64Ref.current) {
      proposal.pdf = proposalPdfBase64Ref.current;
    }
    proposal.status = 'revised';
    proposal.revisionInstructions = instructions;
    proposal.revisedAt = new Date().toISOString();

    console.log(`Proposal ${proposalId} revised:`, result);
    return res.setHeader('Content-Type', 'text/html').status(200).send(
      renderApprovalPage(proposal, baseUrl, 'Proposal revised and sent for re-review. Check your email and Telegram.')
    );
  }

  return res.status(400).json({ error: 'Invalid action. Use "approve" or "revise".' });
};
