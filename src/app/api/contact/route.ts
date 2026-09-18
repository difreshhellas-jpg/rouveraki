import { NextResponse } from "next/server";
import { z } from "zod";
import { sanitizeText } from "@/lib/sanitize";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

const ContactSchema = z
  .object({
    name: z.string().min(1).max(120),
    email: z.string().email().max(200),
    message: z.string().min(1).max(2000),
    consent: z.literal(true),
    /** Honeypot: a real person leaves this empty. */
    website: z.string().max(0).optional().default(""),
  })
  .strict();

/**
 * Footer contact form.
 *
 * TODO:OWNER — decide where these should land. Right now they are logged and
 * (if CONTACT_FORWARD_TO plus an SMTP/API key are configured) emailed on. A
 * shop that checks Facebook messages more often than email may prefer this to
 * forward somewhere else entirely; the transport is the only thing to change.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`contact:${clientIp(req)}`, 5, 15 * 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const parsed = ContactSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  // Silently accept and drop honeypot hits so bots get no signal.
  if (parsed.data.website) return NextResponse.json({ ok: true });

  const name = sanitizeText(parsed.data.name, 120);
  const email = sanitizeText(parsed.data.email, 200);
  const message = sanitizeText(parsed.data.message, 2000);

  const forwardTo = process.env.CONTACT_FORWARD_TO;
  const resendKey = process.env.RESEND_API_KEY;

  if (forwardTo && resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.CONTACT_FROM ?? "Rouveraki <noreply@rouveraki.gr>",
          to: [forwardTo],
          reply_to: email,
          subject: `${BRAND.nameEn} — μήνυμα από ${name}`,
          text: `Από: ${name} <${email}>\n\n${message}`,
        }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    } catch (e) {
      console.error("[contact] forward failed", e);
      return NextResponse.json({ error: "send_failed" }, { status: 502 });
    }
  } else {
    console.info(`[contact] ${name} <${email}>\n${message}`);
  }

  return NextResponse.json({ ok: true });
}
