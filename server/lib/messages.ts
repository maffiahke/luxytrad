import { prisma } from "./prisma";
import { mpesaConfig } from "./mpesa";

/**
 * In-app notification feed for the Android "Messages" app. Financial flows
 * write a message row here; the trader's phone picks it up via the WebView
 * poller (GET /api/messages) and surfaces it as a native Android notification.
 */

export interface NotificationInput {
  userId: string;
  /** Short header the phone shows as the notification title, e.g. "MPESA". */
  title: string;
  /** The alert itself — what the user reads on the notification shade. */
  body: string;
}

/**
 * Fire-and-forget message writer. Never throws: a notification must never
 * break (or roll back) the financial flow that triggered it, so callers can
 * `void notifyUser(...)` safely.
 */
export async function notifyUser(input: NotificationInput): Promise<void> {
  try {
    await prisma.message.create({
      data: { userId: input.userId, title: input.title, body: input.body },
    });
  } catch {
    /* the feed is best-effort */
  }
}

/* ---------------------- M-Pesa B2C receipt notification ---------------------- */
/**
 * Payouts are confirmed to the trader in the SAME wording Safaricom uses for a
 * B2C payment received, so the in-app notification reads like the SMS that
 * lands on the phone. Everything volatile is generated per payout:
 *   • a 10-character receipt code (e.g. UK5KM0WDVR)
 *   • the KES amount (converted from the platform amount with the live rate)
 *   • date + time (d/m/yy at h:mm AM/PM, Africa/Nairobi)
 *   • "New M-PESA balance" — we cannot read the trader's real wallet balance,
 *     so it continues a running simulated balance started at the first payout
 *     and parsed back from the previous message's stable "New M-PESA balance
 *     is Ksh…" phrase.
 */

/** Marketing tail appended to the receipt, verbatim from the M-Pesa template. */
const B2C_TAIL = "Invest & earn daily interest with ZIIDI on https://saf.cx/cF6i";

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
/** Safaricom receipt format: 10 upper-case alphanumerics. */
function newMpesaCode(): string {
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/** KES formatting that matches the template: 2dp, no thousands separators. */
const kes = (n: number): string => n.toFixed(2);

/** Local Nairobi date + "h:mm AM/PM" stamp from a UTC instant. */
function nairobiStamp(at: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Nairobi",
    day: "numeric",
    month: "numeric",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(at);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("day")}/${get("month")}/${get("year")}`,
    time: `${get("hour")}:${get("minute")} ${get("dayPeriod")}`,
  };
}

export interface B2cPayoutInput {
  userId: string;
  /** Platform-amount that was paid out (converted to KES with the live rate). */
  amountUsd: number;
}

/** Write one payout receipt message in the Safaricom B2C template. */
export async function notifyMpesaB2c(input: B2cPayoutInput): Promise<void> {
  try {
    const cfg = mpesaConfig();
    const amountKes = input.amountUsd * cfg.kesRate;

    // Continue the running simulated wallet balance from the last receipt.
    const last = await prisma.message.findFirst({
      where: { userId: input.userId, title: "MPESA", body: { contains: "New M-PESA balance is Ksh" } },
      orderBy: { createdAt: "desc" },
      select: { body: true },
    });
    const prevMatch = last?.body.match(/New M-PESA balance is Ksh([\d,.]+)/);
    const prev = prevMatch ? parseFloat(prevMatch[1].replace(/,/g, "")) : 0;
    const balance = prev + amountKes;

    const { date, time } = nairobiStamp(new Date());
    await notifyUser({
      userId: input.userId,
      title: "MPESA",
      body:
        `${newMpesaCode()} Confirmed. You have received Ksh${kes(amountKes)}` +
        ` from ${cfg.accountRef} B2C on ${date} at ${time}` +
        ` New M-PESA balance is Ksh${kes(balance)}. ${B2C_TAIL}`,
    });
  } catch {
    /* a notification must never break the payout */
  }
}
