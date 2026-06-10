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

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${OFFWHITE};font-family:Calibri,'Segoe UI',system-ui,-apple-system,sans-serif;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${OFFWHITE};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <!-- Inner container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;overflow:hidden;">

          <!-- RLK Gradient Bar -->
          <tr>
            <td style="font-size:0;line-height:0;height:5px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:20%;background-color:${NAVY};height:5px;font-size:1px;line-height:1px;">&nbsp;</td>
                  <td style="width:20%;background-color:${SECONDARY};height:5px;font-size:1px;line-height:1px;">&nbsp;</td>
                  <td style="width:20%;background-color:${TERTIARY};height:5px;font-size:1px;line-height:1px;">&nbsp;</td>
                  <td style="width:20%;background-color:${ACCENT};height:5px;font-size:1px;line-height:1px;">&nbsp;</td>
                  <td style="width:20%;background-color:${LIGHT};height:5px;font-size:1px;line-height:1px;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background-color:${NAVY};padding:32px 40px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:13px;font-weight:bold;color:#ffffff;letter-spacing:4px;text-transform:uppercase;text-align:center;">
                    RLK CONSULTING
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:11px;color:${ACCENT};letter-spacing:2px;text-transform:uppercase;text-align:center;padding-top:8px;">
                    AI Diagnostic Report
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body content -->
          <tr>
            <td style="padding:40px 40px 24px 40px;">
              <!-- Greeting -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:18px;color:${NAVY};line-height:28px;padding-bottom:24px;font-weight:600;">
                    ${recipientName},
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:15px;color:${BODY_TEXT};line-height:26px;padding-bottom:24px;">
                    Your RLK AI Diagnostic for <strong style="color:${NAVY};">${companyName}</strong> is complete. Your full interactive report is ready. Nine sections, instant access, no login required.
                  </td>
                </tr>
              </table>

              <!-- Findings summary box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${OFFWHITE};border-left:3px solid ${NAVY};margin-bottom:24px;">
                <tr>
                  <td style="padding:24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:11px;color:${TERTIARY};letter-spacing:2px;text-transform:uppercase;padding-bottom:14px;font-weight:600;">
                          Key Findings
                        </td>
                      </tr>
                      <tr>
                        <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:14px;color:${BODY_TEXT};line-height:24px;">
                          <strong style="color:${NAVY};">Stage ${stageNumber}: ${stageName}</strong> &nbsp;|&nbsp; Overall Score: <strong style="color:${NAVY};">${overallScore}/100</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:14px;color:${BODY_TEXT};line-height:24px;padding-top:8px;">
                          Estimated unrealized AI value: <strong style="color:${NAVY};">${valueLow} &ndash; ${valueHigh}</strong> annually
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Primary CTA: Access Report -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${reportUrl}" style="height:52px;v-text-anchor:middle;width:300px;" arcsize="0%" strokecolor="${NAVY}" fillcolor="${NAVY}">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Calibri,sans-serif;font-size:14px;font-weight:bold;">ACCESS YOUR INTERACTIVE REPORT</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${reportUrl}" target="_blank" style="display:inline-block;background-color:${NAVY};color:#ffffff;font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:16px 40px;letter-spacing:1px;text-transform:uppercase;">
                      Access Your Interactive Report
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:12px;color:${TERTIARY};text-align:center;padding-top:10px;">
                    No login required &nbsp;&middot;&nbsp; Nine sections &nbsp;&middot;&nbsp; Instant access
                  </td>
                </tr>
              </table>

              <!-- Separator -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td style="border-top:1px solid ${LIGHT};font-size:1px;line-height:1px;">&nbsp;</td>
                </tr>
              </table>

              <!-- Secondary CTA: Schedule with Calendly -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:14px;color:${BODY_TEXT};line-height:24px;padding-bottom:16px;">
                    I review every report personally. If you want to walk through the findings together: what the scores mean for your specific situation, where to act first, how to frame this for your board. Use the link below to schedule time directly.
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <!--[if !mso]><!-->
                    <a href="${scheduleUrl || `mailto:ryan.king@rlkconsultingco.com?subject=AI%20Diagnostic%20Follow-Up%20%E2%80%94%20${encodeURIComponent(companyName)}`}" target="_blank" style="display:inline-block;background-color:transparent;color:${NAVY};font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:13px;font-weight:bold;text-decoration:none;padding:13px 36px;letter-spacing:1px;text-transform:uppercase;border:2px solid ${NAVY};">
                      Schedule Time to Discuss Results
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding:0 40px 32px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${LIGHT};">
                <tr>
                  <td style="padding-top:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:14px;color:${NAVY};line-height:22px;font-weight:600;">
                          Ryan King
                        </td>
                      </tr>
                      <tr>
                        <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:12px;color:${TERTIARY};line-height:20px;">
                          Founder, RLK Consulting
                        </td>
                      </tr>
                      <tr>
                        <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:12px;color:${TERTIARY};line-height:20px;">
                          <a href="mailto:ryan.king@rlkconsultingco.com" style="color:${SECONDARY};text-decoration:none;">ryan.king@rlkconsultingco.com</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:${NAVY};padding:24px 40px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:12px;color:${ACCENT};text-align:center;padding-bottom:8px;">
                    <a href="https://www.rlkconsultingco.com" target="_blank" rel="noopener noreferrer" style="color:${ACCENT};text-decoration:none;font-weight:600;">
                      www.rlkconsultingco.com
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:11px;color:${TERTIARY};text-align:center;">
                    RLK Consulting, LLC &nbsp;|&nbsp; CIO Advisory
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bottom gradient bar -->
          <tr>
            <td style="font-size:0;line-height:0;height:4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:20%;background-color:${NAVY};height:4px;font-size:1px;line-height:1px;">&nbsp;</td>
                  <td style="width:20%;background-color:${SECONDARY};height:4px;font-size:1px;line-height:1px;">&nbsp;</td>
                  <td style="width:20%;background-color:${TERTIARY};height:4px;font-size:1px;line-height:1px;">&nbsp;</td>
                  <td style="width:20%;background-color:${ACCENT};height:4px;font-size:1px;line-height:1px;">&nbsp;</td>
                  <td style="width:20%;background-color:${LIGHT};height:4px;font-size:1px;line-height:1px;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Inner container -->
      </td>
    </tr>
  </table>
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

I review every report personally. If you want to walk through the findings together: what the scores mean, where to act first, how to frame this for your board. Schedule time directly:

${scheduleUrl || 'ryan.king@rlkconsultingco.com'}

Ryan King
Founder, RLK Consulting
ryan.king@rlkconsultingco.com

${'='.repeat(52)}
www.rlkconsultingco.com
RLK Consulting, LLC | CIO Advisory
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
<tr><td style="background:${NAVY};padding:18px 24px;border-left:4px solid ${accentColor};">
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
