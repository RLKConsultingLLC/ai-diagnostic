// =============================================================================
// RLK AI Diagnostic — Email Sender
// =============================================================================
// Sends diagnostic report emails via Resend. Reads RESEND_API_KEY from
// environment variables. Wraps the template builder for a single-call API.
// =============================================================================

import { Resend } from 'resend';
import { buildReportEmail } from './templates';

const FROM_ADDRESS = 'diagnostics@rlkconsultingco.com';
const FROM_NAME = 'RLK Consulting';

export interface SendReportEmailInput {
  to: string;
  recipientName: string;
  companyName: string;
  stageName: string;
  stageNumber: number;
  unrealizedValueLow: number;
  unrealizedValueHigh: number;
  overallScore: number;
  reportUrl: string;
}

export interface SendReportEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendReportEmail(
  input: SendReportEmailInput
): Promise<SendReportEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY environment variable is not set. Cannot send email.'
    );
  }

  const resend = new Resend(apiKey);

  const { to, ...templateInput } = input;
  const { subject, html, text } = buildReportEmail(templateInput);

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_ADDRESS}>`,
    to: [to],
    subject,
    html,
    text,
  });

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: true,
    id: data?.id,
  };
}
