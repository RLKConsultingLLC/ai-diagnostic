// =============================================================================
// RLK AI Diagnostic. Email Templates
// =============================================================================
// Branded email builder for delivering AI diagnostic reports to executives.
// Uses inline CSS and table-based layout for maximum email client compatibility.
// Matches RLK navy color scheme.
// =============================================================================

export interface ReportEmailInput {
  recipientName: string;
  companyName: string;
  stageName: string;
  stageNumber: number;
  unrealizedValueLow: number;
  unrealizedValueHigh: number;
  overallScore: number;
  reportUrl: string;
  calendlyUrl?: string;
}

export interface ReportEmailOutput {
  subject: string;
  html: string;
  text: string;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

// RLK Brand Colors
const NAVY = '#0B1D3A';
const SECONDARY = '#364E6E';
const TERTIARY = '#6B7F99';
const ACCENT = '#A8B5C4';
const LIGHT = '#CED5DD';
const OFFWHITE = '#F7F8FA';
const BODY_TEXT = '#2D2D2D';

export function buildReportEmail(input: ReportEmailInput): ReportEmailOutput {
  const {
    recipientName,
    companyName,
    stageName,
    stageNumber,
    unrealizedValueLow,
    unrealizedValueHigh,
    overallScore,
    reportUrl,
    calendlyUrl,
  } = input;

  const scheduleUrl = calendlyUrl || process.env.CALENDLY_URL || '';

  const valueLow = formatCurrency(unrealizedValueLow);
  const valueHigh = formatCurrency(unrealizedValueHigh);

  const subject = `Your AI Diagnostic Report | ${companyName}`;

  const FONT = "Calibri,'Segoe UI',system-ui,sans-serif";

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:${OFFWHITE};font-family:${FONT};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${OFFWHITE};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;overflow:hidden;">

<!-- Five-stripe gradient bar -->
<tr><td style="font-size:0;line-height:0;height:5px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="width:20%;background:${NAVY};height:5px;">&nbsp;</td>
<td style="width:20%;background:${SECONDARY};height:5px;">&nbsp;</td>
<td style="width:20%;background:${TERTIARY};height:5px;">&nbsp;</td>
<td style="width:20%;background:${ACCENT};height:5px;">&nbsp;</td>
<td style="width:20%;background:${LIGHT};height:5px;">&nbsp;</td>
</tr></table></td></tr>

<!-- Header -->
<tr><td style="background:${NAVY};padding:32px 40px;text-align:center;">
<div style="font-size:13px;font-weight:bold;color:#fff;letter-spacing:4px;text-transform:uppercase;">RLK CONSULTING</div>
<div style="font-size:11px;color:${ACCENT};letter-spacing:2px;text-transform:uppercase;padding-top:8px;">AI Diagnostic Report</div>
</td></tr>

<!-- Body -->
<tr><td style="padding:40px 40px 24px;">
<p style="font-size:15px;color:${BODY_TEXT};line-height:26px;margin:0 0 20px;">Hi ${recipientName}. Your RLK AI Diagnostic for <strong style="color:${NAVY};">${companyName}</strong> is complete.</p>

<!-- Findings box -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${OFFWHITE};border:1px solid ${LIGHT};margin-bottom:28px;">
<tr><td style="padding:20px 24px 12px;font-size:11px;color:${TERTIARY};letter-spacing:2px;text-transform:uppercase;font-weight:600;">Key Findings</td></tr>
<tr><td style="padding:0 24px 6px;font-size:14px;color:${BODY_TEXT};line-height:24px;"><strong style="color:${NAVY};">Stage ${stageNumber}: ${stageName}</strong> &nbsp;|&nbsp; Overall Score: <strong style="color:${NAVY};">${overallScore}/100</strong></td></tr>
<tr><td style="padding:0 24px 20px;font-size:14px;color:${BODY_TEXT};line-height:24px;">Estimated unrealized AI value: <strong style="color:${NAVY};">${valueLow} &ndash; ${valueHigh}</strong> annually</td></tr>
</table>

<!-- Primary CTA -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
<tr><td align="center">
<a href="${reportUrl}" target="_blank" style="display:inline-block;background:${NAVY};color:#fff;font-size:11px;font-weight:bold;text-decoration:none;padding:10px 20px;letter-spacing:1px;text-transform:uppercase;">Access Your Interactive Report</a>
</td></tr>
<tr><td style="font-size:12px;color:${TERTIARY};text-align:center;padding-top:10px;">No login required. Bookmark this link to return any time.</td></tr>
</table>

<p style="font-size:14px;color:${BODY_TEXT};line-height:24px;margin:0 0 20px;">I review every report personally. If you want to walk through the findings and talk about next steps, use the link below to schedule time directly.</p>

<!-- Secondary CTA -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
<tr><td align="center">
<a href="${scheduleUrl || `mailto:hello@rlkconsultingco.com?subject=AI%20Diagnostic%20Follow-Up%20-%20${encodeURIComponent(companyName)}`}" target="_blank" style="display:inline-block;background:${SECONDARY};color:#fff;font-size:11px;font-weight:bold;text-decoration:none;padding:10px 20px;letter-spacing:1px;text-transform:uppercase;">Schedule Time to Discuss Results</a>
</td></tr>
</table>
</td></tr>

<!-- Signature -->
<tr><td style="padding:0 40px 32px;">
<div style="font-size:14px;color:${NAVY};font-weight:600;">Ryan King</div>
<div style="font-size:12px;color:${TERTIARY};">Founder, RLK Consulting</div>
<div style="font-size:12px;color:${TERTIARY};"><a href="mailto:hello@rlkconsultingco.com" style="color:${SECONDARY};text-decoration:none;">hello@rlkconsultingco.com</a></div>
</td></tr>

<!-- Footer -->
<tr><td style="background:${NAVY};padding:24px 40px;text-align:center;">
<div style="font-size:12px;padding-bottom:6px;"><a href="https://www.rlkconsultingco.com" style="color:${ACCENT};text-decoration:none;font-weight:600;">www.rlkconsultingco.com</a></div>
<div style="font-size:11px;color:${TERTIARY};">RLK Consulting, LLC | Strategy Advisory | Richmond, VA</div>
<div style="font-size:10px;color:${SECONDARY};padding-top:10px;">You are receiving this because you completed an AI diagnostic at rlkconsultingco.com.</div>
</td></tr>

</table></td></tr></table>
  <!-- /Outer wrapper -->
</body>
</html>`;

  const text = `RLK CONSULTING | AI DIAGNOSTIC REPORT
${'='.repeat(52)}

${recipientName},

Your RLK AI Diagnostic for ${companyName} is complete. Your full interactive report is ready below.

ACCESS YOUR REPORT
${reportUrl}

KEY FINDINGS
${'-'.repeat(52)}
Stage ${stageNumber}: ${stageName} | Overall Score: ${overallScore}/100
Estimated unrealized AI value: ${valueLow} - ${valueHigh} annually

${'-'.repeat(52)}

I review every report personally. If you want to walk through the findings and talk about next steps, schedule time directly:

${scheduleUrl || 'hello@rlkconsultingco.com'}

Ryan King
Founder, RLK Consulting
hello@rlkconsultingco.com

${'='.repeat(52)}
www.rlkconsultingco.com
RLK Consulting, LLC
`;

  return { subject, html, text };
}

// =============================================================================
// OPERATOR NOTIFICATIONS
// =============================================================================
// Internal notifications sent to ryan.king@rlkconsultingco.com whenever a
// prospect starts the diagnostic or successfully pays. These are short,
// data-dense emails optimized for fast triage in the inbox.
// =============================================================================

export interface StartedNotificationInput {
  companyName: string;
  industryLabel: string;
  revenue?: number;
  employeeCount?: number;
  publicOrPrivate?: string;
  regulatoryIntensity?: string;
  executiveName?: string;
  executiveTitle?: string;
  executiveEmail?: string;
  websiteUrl?: string;
  ticker?: string;
  sessionId: string;
  reportUrl: string;
  timestamp: string;
}

function fmtUSD(n?: number): string {
  if (n == null) return 'n/a';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export function buildStartedNotificationEmail(input: StartedNotificationInput): ReportEmailOutput {
  const subject = `New diagnostic started: ${input.companyName}`;

  const rows = [
    ['Company', input.companyName + (input.ticker ? ` (${input.ticker})` : '')],
    ['Industry', input.industryLabel],
    ['Revenue', fmtUSD(input.revenue)],
    ['Employees', input.employeeCount ? input.employeeCount.toLocaleString() : 'n/a'],
    ['Public or private', input.publicOrPrivate || 'n/a'],
    ['Regulatory intensity', input.regulatoryIntensity || 'n/a'],
    ['Executive', `${input.executiveName || 'n/a'}${input.executiveTitle ? ', ' + input.executiveTitle : ''}`],
    ['Executive email', input.executiveEmail || 'not provided'],
    ['Website', input.websiteUrl || 'n/a'],
    ['Started at', input.timestamp],
  ];

  const tableHtml = rows.map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:${TERTIARY};font-size:13px;width:160px;vertical-align:top;">${k}</td><td style="padding:6px 0;color:${BODY_TEXT};font-size:14px;font-weight:600;">${v}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:${OFFWHITE};color:${BODY_TEXT};">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${OFFWHITE};padding:32px 16px;"><tr><td>
<table cellpadding="0" cellspacing="0" border="0" align="center" style="background:white;max-width:580px;width:100%;border:1px solid ${LIGHT};">
<tr><td style="background:${NAVY};padding:18px 24px;">
<div style="color:rgba(255,255,255,0.6);font-size:10px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;">RLK AI Diagnostic. Operator Notification</div>
<div style="color:white;font-size:18px;font-weight:700;margin-top:6px;">New diagnostic started</div>
</td></tr>
<tr><td style="padding:24px;">
<p style="margin:0 0 16px;font-size:14px;color:${BODY_TEXT};">A prospect has started the diagnostic. Details below.</p>
<table cellpadding="0" cellspacing="0" border="0" width="100%">${tableHtml}</table>
<div style="margin-top:24px;text-align:center;">
<a href="${input.reportUrl}" style="display:inline-block;background:${NAVY};color:white;font-size:13px;font-weight:600;padding:10px 22px;text-decoration:none;letter-spacing:0.05em;">View live report</a>
</div>
<p style="margin:24px 0 0;font-size:11px;color:${TERTIARY};">Session ID: ${input.sessionId}</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = `RLK AI Diagnostic. New diagnostic started\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nView live report: ${input.reportUrl}\nSession ID: ${input.sessionId}\n`;

  return { subject, html, text };
}

export interface UnlockNotificationInput {
  companyName: string;
  industryLabel: string;
  revenue?: number;
  employeeCount?: number;
  executiveName?: string;
  executiveTitle?: string;
  executiveEmail: string;     // required, this is the unlock email
  websiteUrl?: string;
  ticker?: string;
  overallScore?: number;
  stageName?: string;
  sessionId: string;
  reportUrl: string;
  timestamp: string;
  subscribedToNewsletter: boolean;
}

export function buildUnlockNotificationEmail(input: UnlockNotificationInput): ReportEmailOutput {
  const subject = `Diagnostic completed: ${input.companyName} (${input.executiveEmail})`;

  const rows = [
    ['Email captured', input.executiveEmail],
    ['Newsletter subscribed', input.subscribedToNewsletter ? 'yes' : 'no (check MailerLite config)'],
    ['Company', input.companyName + (input.ticker ? ` (${input.ticker})` : '')],
    ['Industry', input.industryLabel],
    ['Revenue', fmtUSD(input.revenue)],
    ['Employees', input.employeeCount ? input.employeeCount.toLocaleString() : 'n/a'],
    ['Executive', `${input.executiveName || 'n/a'}${input.executiveTitle ? ', ' + input.executiveTitle : ''}`],
    ['Website', input.websiteUrl || 'n/a'],
    ['Overall score', input.overallScore != null ? String(input.overallScore) : 'n/a'],
    ['Stage', input.stageName || 'n/a'],
    ['Completed at', input.timestamp],
  ];

  const tableHtml = rows.map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:${TERTIARY};font-size:13px;width:170px;vertical-align:top;">${k}</td><td style="padding:6px 0;color:${BODY_TEXT};font-size:14px;font-weight:600;">${v}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:${OFFWHITE};color:${BODY_TEXT};">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${OFFWHITE};padding:32px 16px;"><tr><td>
<table cellpadding="0" cellspacing="0" border="0" align="center" style="background:white;max-width:580px;width:100%;border:1px solid ${LIGHT};">
<tr><td style="background:${NAVY};padding:18px 24px;">
<div style="color:rgba(255,255,255,0.6);font-size:10px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;">RLK AI Diagnostic. Operator Notification</div>
<div style="color:white;font-size:18px;font-weight:700;margin-top:6px;">Diagnostic completed and unlocked</div>
</td></tr>
<tr><td style="padding:24px;">
<p style="margin:0 0 16px;font-size:14px;color:${BODY_TEXT};">A prospect completed the diagnostic and entered their email to view the report. Reply to them directly if it looks like a fit.</p>
<table cellpadding="0" cellspacing="0" border="0" width="100%">${tableHtml}</table>
<div style="margin-top:24px;text-align:center;">
<a href="${input.reportUrl}" style="display:inline-block;background:${NAVY};color:white;font-size:13px;font-weight:600;padding:10px 22px;text-decoration:none;letter-spacing:0.05em;">View their report</a>
</div>
<p style="margin:24px 0 0;font-size:11px;color:${TERTIARY};">Session ID: ${input.sessionId}</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = `RLK AI Diagnostic. Diagnostic completed and unlocked\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nView their report: ${input.reportUrl}\nSession ID: ${input.sessionId}\n`;

  return { subject, html, text };
}

export interface PaymentNotificationInput {
  companyName: string;
  industryLabel: string;
  revenue?: number;
  employeeCount?: number;
  executiveName?: string;
  executiveTitle?: string;
  executiveEmail?: string;
  customerEmail?: string;
  sessionId: string;
  reportUrl: string;
  amountUsd?: number;
  paymentMethod: 'stripe' | 'bypass';
  stripeSessionId?: string;
  promoCode?: string;
  timestamp: string;
}

export function buildPaymentNotificationEmail(input: PaymentNotificationInput): ReportEmailOutput {
  const isBypass = input.paymentMethod === 'bypass';
  const subject = isBypass
    ? `Bypass code used: ${input.companyName}`
    : `Paid: ${input.companyName}, $${input.amountUsd ?? 397}`;

  const rows = [
    ['Company', input.companyName],
    ['Industry', input.industryLabel],
    ['Revenue', fmtUSD(input.revenue)],
    ['Employees', input.employeeCount ? input.employeeCount.toLocaleString() : 'n/a'],
    ['Executive', `${input.executiveName || 'n/a'}${input.executiveTitle ? ', ' + input.executiveTitle : ''}`],
    ['Customer email', input.customerEmail || 'not provided'],
    ['Payment method', isBypass ? `Bypass code (${input.promoCode || 'n/a'})` : 'Stripe live'],
    ['Amount', isBypass ? '$0 (bypass)' : `$${input.amountUsd ?? 397}`],
    ['Stripe session', input.stripeSessionId || 'n/a'],
    ['Paid at', input.timestamp],
  ];

  const tableHtml = rows.map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:${TERTIARY};font-size:13px;width:160px;vertical-align:top;">${k}</td><td style="padding:6px 0;color:${BODY_TEXT};font-size:14px;font-weight:600;">${v}</td></tr>`).join('');

  const accentColor = isBypass ? '#A36A00' : '#0F7A3E';
  const headerLabel = isBypass ? 'Bypass code used' : 'Diagnostic paid';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:${OFFWHITE};color:${BODY_TEXT};">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${OFFWHITE};padding:32px 16px;"><tr><td>
<table cellpadding="0" cellspacing="0" border="0" align="center" style="background:white;max-width:580px;width:100%;border:1px solid ${LIGHT};">
<tr><td style="background:${NAVY};padding:18px 24px;">
<div style="color:rgba(255,255,255,0.6);font-size:10px;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;">RLK AI Diagnostic. Operator Notification</div>
<div style="color:white;font-size:18px;font-weight:700;margin-top:6px;">${headerLabel}</div>
</td></tr>
<tr><td style="padding:24px;">
<p style="margin:0 0 16px;font-size:14px;color:${BODY_TEXT};">${isBypass ? 'A bypass code was used to unlock the full report.' : 'A prospect has paid for the full diagnostic report.'}</p>
<table cellpadding="0" cellspacing="0" border="0" width="100%">${tableHtml}</table>
<div style="margin-top:24px;text-align:center;">
<a href="${input.reportUrl}" style="display:inline-block;background:${NAVY};color:white;font-size:13px;font-weight:600;padding:10px 22px;text-decoration:none;letter-spacing:0.05em;">Open full report</a>
</div>
<p style="margin:24px 0 0;font-size:11px;color:${TERTIARY};">Session ID: ${input.sessionId}</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = `RLK AI Diagnostic. ${headerLabel}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nOpen full report: ${input.reportUrl}\nSession ID: ${input.sessionId}\n`;

  return { subject, html, text };
}
