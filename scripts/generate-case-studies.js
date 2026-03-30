// ============================================================================
// EDRA(TM) Case Study PDF Generator
// Generates 9 branded case study PDFs using pdf-lib
// ============================================================================

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// ── Brand Colors ────────────────────────────────────────────────────────────
const DEEP_GREEN = rgb(1 / 255, 58 / 255, 43 / 255);       // #013A2B
const GOLD = rgb(200 / 255, 169 / 255, 110 / 255);          // #C8A96E
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);
const LIGHT_BG = rgb(0.96, 0.96, 0.94);                     // light warm gray for table rows
const DARK_TEXT = rgb(0.12, 0.12, 0.12);
const MUTED_TEXT = rgb(0.4, 0.4, 0.4);

// ── ASCII Sanitizer ─────────────────────────────────────────────────────────
// pdf-lib standard fonts only support WinAnsi encoding (subset of ASCII).
// All text must be sanitized before passing to drawText().
function sanitizeForPdf(text) {
  return text
    .replace(/\u2122/g, 'TM')        // trademark symbol
    .replace(/\u00AE/g, '(R)')       // registered
    .replace(/\u00A9/g, '(c)')       // copyright
    .replace(/\u2014/g, '--')        // em-dash
    .replace(/\u2013/g, '-')         // en-dash
    .replace(/\u2018/g, "'")         // left single curly quote
    .replace(/\u2019/g, "'")         // right single curly quote
    .replace(/\u201C/g, '"')         // left double curly quote
    .replace(/\u201D/g, '"')         // right double curly quote
    .replace(/\u2026/g, '...')       // ellipsis
    .replace(/\u00B7/g, '-')         // middle dot
    .replace(/\u2022/g, '-')         // bullet
    .replace(/[^\x20-\x7E\n]/g, '') // strip anything non-printable ASCII
    .trim();
}

// ── Case Study Data ─────────────────────────────────────────────────────────

const CASE_STUDIES = [
  {
    filename: 'gresb-submissions-fail-on-data.pdf',
    title: '15-Asset Office Portfolio -- First GRESB Qualification',
    challenge: 'Portfolio had never qualified for GRESB. 4 assets had coverage below 75%. Fund manager assumed data was complete.',
    before: { edra: 42, b: 38, c: '0 (gated)', g: 55, status: 'Dependent Mode', codes: ['COVERAGE_LT_75 (4 assets)', 'COMPLETENESS_LT_75 (2 assets)'] },
    fix: [
      'Metering boundary audit across all 15 assets',
      'Tenant data collection program initiated',
      '2 sub-meters installed for gap coverage',
      'Coverage validation against GRESB thresholds'
    ],
    after: { edra: 71, b: 78, c: 62, g: 68, status: 'Decision-Grade', codes: ['All coverage codes resolved'] },
    timeline: '3 weeks'
  },
  {
    filename: 'mit-study-data-readiness.pdf',
    title: 'UK REIT -- From Dependent Mode to Decision-Grade',
    challenge: 'Strong ESG budget but fragmented data systems across 28 assets. Multiple vendors, no governance controls.',
    before: { edra: 38, b: 32, c: '0 (gated)', g: 28, status: 'Dependent Mode', codes: ['CRITICAL_FIELDS_MISSING (8 assets)', 'COVERAGE_LT_75 (6 assets)', 'No governance controls'] },
    fix: [
      'Centralized data collection across all vendors',
      'Critical field completion for 8 flagged assets',
      'Boundary documentation standardized',
      'Approval workflows established for data sign-off'
    ],
    after: { edra: 76, b: 82, c: 71, g: 65, status: 'Decision-Grade', codes: ['18-month transformation complete'] },
    timeline: '18 months'
  },
  {
    filename: 'coverage-problem-75-percent.pdf',
    title: '22-Asset Mixed Portfolio -- Coverage Recovery',
    challenge: 'Mixed-use portfolio (offices, retail, residential). 9 of 22 assets below 75% coverage. Property managers unaware of metering gaps.',
    before: { edra: 45, b: 41, c: 22, g: 52, status: 'Dependent Mode', codes: ['COVERAGE_LT_75 (9 assets)', 'OCCUPANCY_MISSING (3 assets)'] },
    fix: [
      'Meter mapping across all 22 assets',
      'Tenant sub-metering agreements negotiated',
      'Occupancy data collection from property managers',
      'Coverage threshold monitoring implemented'
    ],
    after: { edra: 73, b: 79, c: 65, g: 70, status: 'Decision-Grade', codes: ['Coverage at 92% across all assets'] },
    timeline: '8 weeks'
  },
  {
    filename: 'temporal-continuity-billing-gaps.pdf',
    title: '30-Asset Portfolio -- Billing Period Correction',
    challenge: '14 assets with billing period overlaps averaging 12 bad days each. Energy data was being double-counted, inflating consumption reports.',
    before: { edra: 51, b: 48, c: 35, g: 58, status: 'Transition Mode', codes: ['CONTINUITY_BAD_DAYS (14 assets)', 'MISSING_BILLING_DATES (3 assets)'] },
    fix: [
      'Utility provider contact for corrected billing dates',
      'Billing period reconciliation across 14 assets',
      'Overlap detection and deduplication',
      'Automated continuity monitoring established'
    ],
    after: { edra: 72, b: 76, c: 64, g: 71, status: 'Decision-Grade', codes: ['Zero bad days across all assets'] },
    timeline: '4 weeks'
  },
  {
    filename: 'sp-global-vs-edra.pdf',
    title: 'Mid-Market Fund -- Data Integrity Discovery',
    challenge: 'Fund paying $200K/year for ESG ratings. Assumed data was sound. EDRA revealed 60% of assets could not pass data integrity thresholds.',
    before: { edra: 35, b: 29, c: '0 (gated)', g: 42, status: 'Dependent Mode', codes: ['COVERAGE_LT_75 (12 assets)', 'CRITICAL_FIELDS_MISSING (8 assets)', 'COMPLETENESS_LT_75 (5 assets)'] },
    fix: [
      'Phased data remediation: critical fields first',
      'Coverage extension across 12 flagged assets',
      'Completeness gap closure for 5 assets',
      'Data integrity threshold validation'
    ],
    after: { edra: 68, b: 74, c: 58, g: 66, status: 'Transition Mode (approaching Decision-Grade)', codes: ['Major integrity gaps resolved'] },
    timeline: '6 months'
  },
  {
    filename: 'consultant-paradox.pdf',
    title: 'Hotel Portfolio -- Pre-Submission Discovery',
    challenge: 'ESG consultant recommended GRESB submission. No data scan performed. EDRA revealed 5 of 8 hotels had critical fields missing.',
    before: { edra: 33, b: 27, c: '0 (gated)', g: 38, status: 'Dependent Mode', codes: ['CRITICAL_FIELDS_MISSING (5 assets)', 'OCCUPANCY_BELOW_THRESHOLD (2 assets)', 'COVERAGE_LT_75 (3 assets)'] },
    fix: [
      'Critical field completion (GFA, occupancy, operating hours)',
      'Occupancy data retrieval from hotel management systems',
      'Coverage extension for 3 under-metered hotels',
      'Pre-submission validation checklist created'
    ],
    after: { edra: 65, b: 72, c: 55, g: 62, status: 'Transition Mode', codes: ['Submission-ready for next cycle'] },
    timeline: '10 weeks'
  },
  {
    filename: 'gresb-incomplete-data-submission.pdf',
    title: 'Canadian Pension Fund -- Post-Rejection Recovery',
    challenge: '40-asset submission to GRESB. 12 assets rejected for data incompleteness. Non-refundable fees lost. LP reporting delayed.',
    before: { edra: 44, b: 40, c: 18, g: 50, status: 'Dependent Mode', codes: ['COMPLETENESS_LT_75 (12 assets)', 'COVERAGE_LT_75 (8 assets)', 'CONTINUITY_BAD_DAYS (5 assets)'] },
    fix: [
      '48-hour EDRA diagnostic across all 40 assets',
      'Targeted data recovery plan for 12 rejected assets',
      'Utility provider outreach for missing records',
      'Continuity correction for billing gap assets'
    ],
    after: { edra: 74, b: 80, c: 66, g: 70, status: 'Decision-Grade', codes: ['All 40 assets qualified in next cycle'] },
    timeline: '12 weeks'
  },
  {
    filename: 'energy-star-decision-grade-data.pdf',
    title: 'US Office Portfolio -- ENERGY STAR Eligibility',
    challenge: '18-asset portfolio. Believed all were ENERGY STAR eligible. Only 11 had required 12 months continuous data.',
    before: { edra: 52, b: 50, c: 38, g: 56, status: 'Transition Mode', codes: ['ENERGY_COMPLETENESS_BELOW_THRESHOLD (7 assets)', 'CONTINUITY_BAD_DAYS (4 assets)'] },
    fix: [
      'Missing month retrieval from utility providers',
      'Billing date corrections for 4 flagged assets',
      '12-month continuity validation per asset',
      'ENERGY STAR data format alignment'
    ],
    after: { edra: 78, b: 84, c: 72, g: 74, status: 'Decision-Grade', codes: ['All 18 assets ENERGY STAR eligible'] },
    timeline: '6 weeks'
  },
  {
    filename: 'governance-controls-esg-score.pdf',
    title: 'Listed REIT -- Governance Transformation',
    challenge: 'Data was decent but governance was informal. No boundary documentation, no approval workflows, no evidence packs.',
    before: { edra: 44, b: 52, c: 41, g: 35, status: 'Dependent Mode', codes: ['G Score dragging overall EDRA score'] },
    fix: [
      'Formalized boundary definition documentation',
      'Evidence retrievability system implemented',
      'Approval workflows for data sign-off',
      'Emission factor versioning and assurance review'
    ],
    after: { edra: 61, b: 58, c: 48, g: 72, status: 'Transition Mode', codes: ['G Score jumped 37 points'] },
    timeline: '6 weeks'
  }
];

// ── PDF Generation ──────────────────────────────────────────────────────────

// Wrap text into lines that fit within maxWidth
function wrapText(text, font, fontSize, maxWidth) {
  const words = sanitizeForPdf(text).split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

async function generateCaseStudyPdf(study) {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 612;  // US Letter
  const PAGE_H = 792;
  const MARGIN = 56;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H;

  // Helper: add new page if needed
  function ensureSpace(needed) {
    if (y - needed < 60) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 40;
    }
  }

  // ── HEADER BAR ──────────────────────────────────────────────────────────
  const HEADER_H = 52;
  page.drawRectangle({
    x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: DEEP_GREEN
  });
  page.drawText(sanitizeForPdf('EDRA(TM) Case Study'), {
    x: MARGIN, y: PAGE_H - 34, size: 16, font: helveticaBold, color: WHITE
  });
  // Gold accent line under header
  page.drawRectangle({
    x: 0, y: PAGE_H - HEADER_H - 3, width: PAGE_W, height: 3, color: GOLD
  });
  y = PAGE_H - HEADER_H - 30;

  // ── TITLE ───────────────────────────────────────────────────────────────
  const titleLines = wrapText(study.title, helveticaBold, 20, CONTENT_W);
  for (const line of titleLines) {
    ensureSpace(28);
    page.drawText(line, { x: MARGIN, y, size: 20, font: helveticaBold, color: DEEP_GREEN });
    y -= 28;
  }
  y -= 10;

  // ── SECTION: The Challenge ──────────────────────────────────────────────
  function drawSectionHeading(text) {
    ensureSpace(36);
    // Gold bar accent
    page.drawRectangle({ x: MARGIN, y: y - 2, width: 40, height: 3, color: GOLD });
    y -= 18;
    page.drawText(sanitizeForPdf(text), { x: MARGIN, y, size: 13, font: helveticaBold, color: DEEP_GREEN });
    y -= 22;
  }

  drawSectionHeading('The Challenge');
  const challengeLines = wrapText(study.challenge, helvetica, 10.5, CONTENT_W);
  for (const line of challengeLines) {
    ensureSpace(16);
    page.drawText(line, { x: MARGIN, y, size: 10.5, font: helvetica, color: DARK_TEXT });
    y -= 16;
  }
  y -= 16;

  // ── SECTION: EDRA Initial Assessment (BEFORE) ──────────────────────────
  drawSectionHeading('EDRA(TM) Initial Assessment');

  // Score table
  function drawScoreTable(scores) {
    const colW = CONTENT_W / 4;
    const labels = ['EDRA Score', 'B Score', 'C Score', 'G Score'];
    const values = [String(scores.edra), String(scores.b), String(scores.c), String(scores.g)];

    ensureSpace(60);
    // Header row bg
    page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_W, height: 20, color: DEEP_GREEN });
    for (let i = 0; i < 4; i++) {
      page.drawText(sanitizeForPdf(labels[i]), {
        x: MARGIN + i * colW + 8, y: y, size: 9, font: helveticaBold, color: WHITE
      });
    }
    y -= 24;

    // Value row bg
    page.drawRectangle({ x: MARGIN, y: y - 4, width: CONTENT_W, height: 20, color: LIGHT_BG });
    for (let i = 0; i < 4; i++) {
      page.drawText(sanitizeForPdf(values[i]), {
        x: MARGIN + i * colW + 8, y: y, size: 10, font: helveticaBold, color: DARK_TEXT
      });
    }
    y -= 28;

    // Status Band
    ensureSpace(20);
    page.drawText(sanitizeForPdf('Status Band: ' + scores.status), {
      x: MARGIN, y, size: 10, font: helveticaBold, color: DARK_TEXT
    });
    y -= 18;

    // Reason Codes
    if (scores.codes && scores.codes.length > 0) {
      ensureSpace(16);
      page.drawText(sanitizeForPdf('Reason Codes:'), {
        x: MARGIN, y, size: 9.5, font: helveticaBold, color: MUTED_TEXT
      });
      y -= 15;
      for (const code of scores.codes) {
        ensureSpace(14);
        page.drawText(sanitizeForPdf('  - ' + code), {
          x: MARGIN + 8, y, size: 9.5, font: helvetica, color: DARK_TEXT
        });
        y -= 14;
      }
    }
    y -= 10;
  }

  drawScoreTable(study.before);

  // ── SECTION: What EDRA Did ─────────────────────────────────────────────
  drawSectionHeading('What EDRA(TM) Did');
  for (const item of study.fix) {
    const bulletLines = wrapText('- ' + item, helvetica, 10.5, CONTENT_W - 12);
    for (let i = 0; i < bulletLines.length; i++) {
      ensureSpace(16);
      page.drawText(bulletLines[i], {
        x: MARGIN + (i === 0 ? 0 : 12), y, size: 10.5, font: helvetica, color: DARK_TEXT
      });
      y -= 16;
    }
  }
  y -= 10;

  // ── SECTION: Results After Data Completion (AFTER) ─────────────────────
  drawSectionHeading('Results After Data Completion');
  drawScoreTable(study.after);

  // ── SECTION: Timeline ──────────────────────────────────────────────────
  ensureSpace(40);
  page.drawRectangle({ x: MARGIN, y: y - 6, width: CONTENT_W, height: 28, color: LIGHT_BG });
  page.drawText(sanitizeForPdf('Timeline: ' + study.timeline), {
    x: MARGIN + 12, y: y, size: 11, font: helveticaBold, color: DEEP_GREEN
  });
  y -= 40;

  // ── FOOTER ─────────────────────────────────────────────────────────────
  // Draw footer on the last page
  const lastPage = doc.getPages()[doc.getPageCount() - 1];
  // Gold line
  lastPage.drawRectangle({ x: MARGIN, y: 46, width: CONTENT_W, height: 1.5, color: GOLD });
  lastPage.drawText(sanitizeForPdf('EDRA(TM) | Environmental Data Readiness Assessment | edra.ai'), {
    x: MARGIN, y: 32, size: 8.5, font: helvetica, color: MUTED_TEXT
  });

  return doc.save();
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const outputDir = path.join(__dirname, '..', 'blog', 'case-studies');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Generating 9 EDRA(TM) case study PDFs...\n');

  for (const study of CASE_STUDIES) {
    const pdfBytes = await generateCaseStudyPdf(study);
    const outputPath = path.join(outputDir, study.filename);
    fs.writeFileSync(outputPath, pdfBytes);
    console.log('  Created: ' + study.filename);
  }

  console.log('\nAll 9 case studies saved to blog/case-studies/');
}

main().catch((err) => {
  console.error('Error generating case studies:', err);
  process.exit(1);
});
