import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/email/resend";
import { buildContactNotification } from "@/lib/email/templates/contactNotification";
import { buildContactAutoReply } from "@/lib/email/templates/contactAutoReply";

// 5 submissions per minute per IP
const RATE_LIMIT = 5;
const RATE_WINDOW = 60 * 1000;

export async function POST(request: NextRequest) {
  // Rate limit
  const ip = getClientIp(request.headers);
  const { allowed } = rateLimit(`contact:${ip}`, RATE_LIMIT, RATE_WINDOW);

  if (!allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  try {
    const body = await request.json();
    const { name, email, phone, company, subject, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: "Name, email, and message are required." },
        { status: 400 },
      );
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    // Send notification to sales team
    const notification = buildContactNotification({
      name,
      email,
      phone,
      company,
      subject,
      message,
    });
    const notifResult = await sendEmail({
      to: "sales@technimark-inc.com",
      subject: notification.subject,
      html: notification.html,
      replyTo: email,
    });

    if (!notifResult.success) {
      console.error("[contact] Failed to send notification:", notifResult.error);
      return NextResponse.json(
        { success: false, error: "Failed to send your message. Please try again or email us directly at sales@technimark-inc.com." },
        { status: 500 },
      );
    }

    // Send auto-reply to customer (best-effort, don't block on failure)
    const autoReply = buildContactAutoReply({ name });
    sendEmail({
      to: email,
      subject: autoReply.subject,
      html: autoReply.html,
    }).catch((err) => console.error("[contact] Auto-reply failed:", err));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to process contact form." },
      { status: 500 },
    );
  }
}
