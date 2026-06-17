import { Resend } from 'resend';

// --- Configuration ---

let resendInstance: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!resendInstance) {
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Cast Studio <notifications@caststudio.local>';

// --- Types ---

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

// --- HTML Template ---

function renderEmailTemplate(data: { title: string; message: string; type: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.title)}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { border-bottom: 2px solid #1a1a2e; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { margin: 0; font-size: 20px; color: #1a1a2e; font-weight: 600; }
    .content p { margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #333; }
    .badge { display: inline-block; background: #e8f4f8; color: #1a1a2e; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 500; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <h1>Cast Studio</h1>
      </div>
      <div class="content">
        <div class="badge">${escapeHtml(data.type.replace(/_/g, ' '))}</div>
        <p><strong>${escapeHtml(data.title)}</strong></p>
        <p>${escapeHtml(data.message)}</p>
      </div>
      <div class="footer">
        <p>You received this notification from Cast Studio. To manage your notification preferences, visit your account settings.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Email Templates by Type ---

const notificationSubjects: Record<string, (data: Record<string, string>) => string> = {
  COMMISSION_ASSIGNED: (d) => `New Commission: ${d.title}`,
  COMMISSION_SUBMITTED: (d) => `Work Submitted: ${d.title}`,
  COMMISSION_APPROVED: (d) => `Commission Approved: ${d.title}`,
  COMMISSION_CHANGES_REQUESTED: (d) => `Changes Requested: ${d.title}`,
  ASSET_SHARED: (d) => `Asset Shared: ${d.asset_name}`,
  WORKFLOW_COMPLETED: (d) => `Workflow Completed: ${d.title}`,
  WORKFLOW_FAILED: (d) => `Workflow Failed: ${d.title}`,
};

function getSubject(type: string, data: Record<string, string> = {}): string {
  const builder = notificationSubjects[type];
  return builder ? builder(data) : 'Cast Studio Notification';
}

// --- Public API ---

/**
 * Send an email notification.
 * This function is fire-and-forget: errors are logged but never thrown.
 * If Resend API key is not configured, it logs and returns successfully.
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const client = getResendClient();

  if (!client) {
    console.log('[email-service] RESEND_API_KEY not configured, skipping email to:', payload.to);
    return;
  }

  try {
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });

    if (result.error) {
      console.error('[email-service] Resend API error:', result.error);
    }
  } catch (err) {
    console.error('[email-service] Failed to send email:', err);
  }
}

/**
 * Build and send a typed notification email.
 * Non-blocking: wraps sendError in a try-catch internally.
 */
export async function sendNotificationEmail(data: {
  to: string;
  type: string;
  title: string;
  message: string;
  templateData?: Record<string, string>;
}): Promise<void> {
  const html = renderEmailTemplate({
    title: data.title,
    message: data.message,
    type: data.type,
  });

  const subject = getSubject(data.type, data.templateData ?? {});

  await sendEmail({
    to: data.to,
    subject,
    html,
  });
}
