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

    // Send notification to sales team (fire-and-forget)
    const notification = buildContactNotification({
      name,
      email,
      phone,
      company,
      subject,
      message,
    });
    sendEmail({
      to: "sales@technimark-inc.com",
      subject: notification.subject,
      html: notification.html,
      replyTo: email,
    }).catch(() => {});

    // Send auto-reply to customer (fire-and-forget)
    const autoReply = buildContactAutoReply({ name });
    sendEmail({
      to: email,
      subject: autoReply.subject,
      html: autoReply.html,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to process contact form." },
      { status: 500 },
    );
  }
}
