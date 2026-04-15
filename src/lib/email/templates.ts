// =============================================================================
// RLK AI Diagnostic — Email Templates
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
  } = input;

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
                    Your RLK AI Diagnostic for <strong style="color:${NAVY};">${companyName}</strong> is complete. The full report is attached as a PDF for your review.
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

              <!-- What's in the report -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:14px;color:${BODY_TEXT};line-height:24px;">
                    Your attached report includes:
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:14px;color:${BODY_TEXT};line-height:26px;padding-top:8px;padding-left:16px;">
                    &bull;&nbsp; Five-dimension AI maturity scoring with benchmarks<br/>
                    &bull;&nbsp; Competitive positioning and industry context<br/>
                    &bull;&nbsp; Economic impact analysis with ROI estimates<br/>
                    &bull;&nbsp; Prioritized 90-day action roadmap
                  </td>
                </tr>
              </table>

              <!-- Separator -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td style="border-top:1px solid ${LIGHT};font-size:1px;line-height:1px;">&nbsp;</td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td style="font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:14px;color:${BODY_TEXT};line-height:24px;">
                    Want to discuss these findings with your leadership team? We offer a complimentary 30-minute strategy session to walk through the results and identify quick wins.
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:16px;" align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="mailto:ryan.king@rlkconsultingco.com?subject=AI Diagnostic Follow-Up" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="0%" strokecolor="${NAVY}" fillcolor="${NAVY}">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:Calibri,sans-serif;font-size:14px;font-weight:bold;">SCHEDULE A STRATEGY SESSION</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="mailto:ryan.king@rlkconsultingco.com?subject=AI%20Diagnostic%20Follow-Up%20%E2%80%94%20${encodeURIComponent(companyName)}" target="_blank" style="display:inline-block;background-color:${NAVY};color:#ffffff;font-family:Calibri,'Segoe UI',system-ui,sans-serif;font-size:13px;font-weight:bold;text-decoration:none;padding:14px 36px;letter-spacing:1px;text-transform:uppercase;">
                      Schedule a Strategy Session
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
                    RLK Consulting, LLC &nbsp;|&nbsp; AI Strategy &amp; Transformation
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

Your RLK AI Diagnostic for ${companyName} is complete. The full report is attached as a PDF.

KEY FINDINGS
${'-'.repeat(52)}
Stage ${stageNumber}: ${stageName} | Overall Score: ${overallScore}/100
Estimated unrealized AI value: ${valueLow} - ${valueHigh} annually

Your report includes:
  - Five-dimension AI maturity scoring with benchmarks
  - Competitive positioning and industry context
  - Economic impact analysis with ROI estimates
  - Prioritized 90-day action roadmap

${'-'.repeat(52)}

Want to discuss these findings? We offer a complimentary 30-minute strategy session. Reply to this email or contact ryan.king@rlkconsultingco.com.

Ryan King
Founder, RLK Consulting
ryan.king@rlkconsultingco.com

${'='.repeat(52)}
www.rlkconsultingco.com
RLK Consulting, LLC | AI Strategy & Transformation
`;

  return { subject, html, text };
}
