// =============================================================================
// RLK AI Board Brief — Email Templates
// =============================================================================
// Branded email builder for delivering AI diagnostic reports to executives.
// Uses inline CSS and table-based layout for maximum email client compatibility.
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

  const subject = 'Your AI Strategy Diagnostic Report — RLK Consulting';

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
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Georgia,'Times New Roman',Times,serif;">
  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <!-- Inner container -->
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:4px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background-color:#1a2332;padding:32px 40px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Georgia,'Times New Roman',Times,serif;font-size:24px;font-weight:bold;color:#c9a84c;letter-spacing:1px;text-align:center;">
                    RLK CONSULTING
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a95a5;letter-spacing:2px;text-transform:uppercase;text-align:center;padding-top:8px;">
                    AI Strategy &amp; Transformation
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Gold accent bar -->
          <tr>
            <td style="background-color:#c9a84c;height:3px;font-size:1px;line-height:1px;">&nbsp;</td>
          </tr>

          <!-- Body content -->
          <tr>
            <td style="padding:40px 40px 24px 40px;">
              <!-- Greeting -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Georgia,'Times New Roman',Times,serif;font-size:18px;color:#1a2332;line-height:28px;padding-bottom:24px;">
                    Dear ${recipientName},
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Georgia,'Times New Roman',Times,serif;font-size:15px;color:#333333;line-height:26px;padding-bottom:24px;">
                    Thank you for completing the RLK AI Strategy Diagnostic on behalf of ${companyName}. Your results have been analyzed against our proprietary AI Maturity Framework, and your full report is now available.
                  </td>
                </tr>
              </table>

              <!-- Findings summary box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f9fa;border-left:4px solid #c9a84c;border-radius:2px;margin-bottom:24px;">
                <tr>
                  <td style="padding:24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a95a5;letter-spacing:1.5px;text-transform:uppercase;padding-bottom:12px;">
                          Key Findings
                        </td>
                      </tr>
                      <tr>
                        <td style="font-family:Georgia,'Times New Roman',Times,serif;font-size:15px;color:#333333;line-height:26px;">
                          ${companyName} is currently positioned at <strong style="color:#1a2332;">Stage ${stageNumber}: ${stageName}</strong> in AI maturity, with an overall readiness score of <strong style="color:#1a2332;">${overallScore} out of 100</strong>. Our analysis indicates an estimated <strong style="color:#1a2332;">${valueLow} to ${valueHigh}</strong> in unrealized annual value from AI capabilities that are within reach given your current organizational profile. The full report details specific dimensions where targeted action will yield the most significant returns.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center" style="padding:8px 0;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${reportUrl}" style="height:52px;v-text-anchor:middle;width:320px;" arcsize="6%" strokecolor="#c9a84c" fillcolor="#c9a84c">
                      <w:anchorlock/>
                      <center style="color:#1a2332;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">VIEW YOUR FULL REPORT</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${reportUrl}" target="_blank" style="display:inline-block;background-color:#c9a84c;color:#1a2332;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;text-decoration:none;padding:16px 48px;border-radius:3px;letter-spacing:0.5px;">
                      VIEW YOUR FULL REPORT
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- Credibility section -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e8e8e8;margin-bottom:24px;">
                <tr>
                  <td style="font-family:Georgia,'Times New Roman',Times,serif;font-size:14px;color:#555555;line-height:24px;padding-top:24px;font-style:italic;">
                    This diagnostic is based on RLK Consulting's proprietary AI Maturity Framework, developed from engagements with over 200 enterprise organizations.
                  </td>
                </tr>
              </table>

              <!-- Closing invitation -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                <tr>
                  <td style="font-family:Georgia,'Times New Roman',Times,serif;font-size:15px;color:#333333;line-height:26px;">
                    We would welcome the opportunity to discuss these findings with your leadership team. A brief conversation can help translate these results into a concrete action plan tailored to ${companyName}'s strategic priorities.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding:0 40px 40px 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e8e8e8;">
                <tr>
                  <td style="padding-top:24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-family:Georgia,'Times New Roman',Times,serif;font-size:15px;color:#1a2332;line-height:24px;">
                          With regard,
                        </td>
                      </tr>
                      <tr>
                        <td style="font-family:Georgia,'Times New Roman',Times,serif;font-size:15px;color:#1a2332;line-height:24px;padding-top:16px;font-weight:bold;">
                          RLK Consulting
                        </td>
                      </tr>
                      <tr>
                        <td style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a95a5;line-height:20px;letter-spacing:0.5px;">
                          AI Strategy &amp; Transformation
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
            <td style="background-color:#1a2332;padding:24px 40px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#8a95a5;line-height:18px;text-align:center;">
                    RLK Consulting | AI Strategy &amp; Transformation
                  </td>
                </tr>
                <tr>
                  <td style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#5a6577;line-height:18px;text-align:center;padding-top:8px;">
                    This report was generated by the RLK AI Board Brief diagnostic platform.
                  </td>
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

  const text = `YOUR AI STRATEGY DIAGNOSTIC REPORT
RLK Consulting | AI Strategy & Transformation
${'='.repeat(52)}

Dear ${recipientName},

Thank you for completing the RLK AI Strategy Diagnostic on behalf of ${companyName}. Your results have been analyzed against our proprietary AI Maturity Framework, and your full report is now available.

KEY FINDINGS
${'-'.repeat(52)}
${companyName} is currently positioned at Stage ${stageNumber}: ${stageName} in AI maturity, with an overall readiness score of ${overallScore} out of 100.

Our analysis indicates an estimated ${valueLow} to ${valueHigh} in unrealized annual value from AI capabilities that are within reach given your current organizational profile.

The full report details specific dimensions where targeted action will yield the most significant returns.

VIEW YOUR FULL REPORT:
${reportUrl}

${'-'.repeat(52)}
This diagnostic is based on RLK Consulting's proprietary AI Maturity Framework, developed from engagements with over 200 enterprise organizations.

We would welcome the opportunity to discuss these findings with your leadership team. A brief conversation can help translate these results into a concrete action plan tailored to ${companyName}'s strategic priorities.

With regard,

RLK Consulting
AI Strategy & Transformation

${'='.repeat(52)}
RLK Consulting | AI Strategy & Transformation
This report was generated by the RLK AI Board Brief diagnostic platform.
`;

  return { subject, html, text };
}
