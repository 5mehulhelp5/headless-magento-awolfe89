import { wrapInLayout } from "./layout";

interface ContactNotificationData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject: string;
  message: string;
}

export function buildContactNotification(data: ContactNotificationData): {
  subject: string;
  html: string;
} {
  const rows = [
    { label: "Name", value: data.name },
    { label: "Email", value: data.email },
    ...(data.phone ? [{ label: "Phone", value: data.phone }] : []),
    ...(data.company ? [{ label: "Company", value: data.company }] : []),
    { label: "Subject", value: data.subject },
  ];

  const tableRows = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#6b7280;font-weight:600;white-space:nowrap;border-bottom:1px solid #f3f4f6;">${r.label}</td>
      <td style="padding:8px 12px;font-size:14px;color:#111827;border-bottom:1px solid #f3f4f6;">${escapeHtml(r.value)}</td>
    </tr>`,
    )
    .join("");

  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">New Contact Form Submission</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
      ${tableRows}
    </table>
    <div style="margin-top:20px;padding:16px;background-color:#f9fafb;border-radius:6px;">
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#6b7280;">Message</p>
      <p style="margin:0;font-size:14px;color:#111827;line-height:1.6;white-space:pre-wrap;">${escapeHtml(data.message)}</p>
    </div>`;

  return {
    subject: `[Contact Form] ${data.subject} from ${data.name}`,
    html: wrapInLayout(bodyHtml),
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
