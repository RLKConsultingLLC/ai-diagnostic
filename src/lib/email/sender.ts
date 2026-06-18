// =============================================================================
// RLK AI Diagnostic. Email Sender
// =============================================================================
// Sends diagnostic report emails via Resend with PDF attachment.
// Reads RESEND_API_KEY from environment variables.
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
  calendlyUrl?: string;
  pdfBuffer?: Buffer; // Optional PDF attachment
}

export interface SendReportEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendReportEmail(
  input: SendReportEmailInput
): Promise<SendReportEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY environment variable is not set. Cannot send email.'
    );
  }

  const resend = new Resend(apiKey);

  const { to, pdfBuffer, ...templateInput } = input;
  const { subject, html, text } = buildReportEmail(templateInput);

  // Build attachments array if PDF is provided
  const attachments = pdfBuffer
    ? [
        {
          filename: `RLK-AI-Diagnostic-${input.companyName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`,
          content: pdfBuffer,
        },
      ]
    : undefined;

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_ADDRESS}>`,
    to: [to],
    subject,
    html,
    text,
    attachments,
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

// =============================================================================
// OPERATOR NOTIFICATIONS
// =============================================================================
// Internal notifications routed to OPERATOR_NOTIFICATION_EMAIL (defaults to
// ryan.king@rlkconsultingco.com). Used for every started-diagnostic event
// and every paid-or-bypassed event. Failure to send must not break the
// user-facing flow, so callers wrap these in try/catch.
// =============================================================================

import {
  buildStartedNotificationEmail,
  buildPaymentNotificationEmail,
  buildUnlockNotificationEmail,
  type StartedNotificationInput,
  type PaymentNotificationInput,
  type UnlockNotificationInput,
} from './templates';

const OPERATOR_EMAIL = process.env.OPERATOR_NOTIFICATION_EMAIL?.trim() || 'ryan.king@rlkconsultingco.com';

async function sendOperatorEmail(subject: string, html: string, text: string): Promise<SendReportEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set, skipping operator notification:', subject);
    return { success: false, error: 'RESEND_API_KEY not set' };
  }
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_ADDRESS}>`,
    to: [OPERATOR_EMAIL],
    subject,
    html,
    text,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, id: data?.id };
}

export async function sendDiagnosticStartedNotification(input: StartedNotificationInput): Promise<SendReportEmailResult> {
  const { subject, html, text } = buildStartedNotificationEmail(input);
  return sendOperatorEmail(subject, html, text);
}

export async function sendPaymentReceivedNotification(input: PaymentNotificationInput): Promise<SendReportEmailResult> {
  const { subject, html, text } = buildPaymentNotificationEmail(input);
  return sendOperatorEmail(subject, html, text);
}

export async function sendDiagnosticUnlockedNotification(input: UnlockNotificationInput): Promise<SendReportEmailResult> {
  const { subject, html, text } = buildUnlockNotificationEmail(input);
  return sendOperatorEmail(subject, html, text);
}
