import { wrapInLayout } from "./layout";

interface ContactAutoReplyData {
  name: string;
}

export function buildContactAutoReply(data: ContactAutoReplyData): {
  subject: string;
  html: string;
} {
  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827;">Thank you, ${escapeHtml(data.name)}</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      We received your message and a member of our team will respond within one business day.
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      If your inquiry is urgent, please call us directly at <strong>(847) 639-4700</strong> during business hours (Mon&ndash;Fri, 8am&ndash;5pm CST).
    </p>
    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
      Best regards,<br />
      <strong>The Technimark-Inc Team</strong>
    </p>`;

  return {
    subject: "We received your message — Technimark-Inc",
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
