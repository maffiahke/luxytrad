import { createTransport, type Transporter } from "nodemailer";
import { prisma } from "./prisma";
import { decrypt } from "./crypto";
import type { EmailTemplateKey } from "../../src/admin/types.js";

/**
 * Automatic-email transport. Reads the SMTP config from the EmailSettings
 * singleton (password decrypted on demand), renders a stored EmailTemplate and
 * delivers it with nodemailer. Every attempt — success or failure — is written to
 * EmailLog so the console can show an outbox. Nothing here ever throws: a mail
 * failure must never break the financial mutation that triggered it.
 */

export interface MailSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
}

export async function loadMailSettings(): Promise<MailSettings> {
  const row = await prisma.emailSettings.upsert({ where: { id: "email" }, create: { id: "email" }, update: {} });
  return {
    enabled: row.enabled,
    host: row.host,
    port: row.port,
    secure: row.secure,
    username: row.username,
    password: row.passwordEnc ? decrypt(row.passwordEnc) ?? "" : "",
    fromName: row.fromName,
    fromEmail: row.fromEmail,
    replyTo: row.replyTo,
  };
}

/** Replace {{var}} placeholders with supplied values (unknown keys are kept as-is). */
export function render(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => vars[k] ?? `{{${k}}}`);
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

function transport(s: MailSettings): Transporter {
  return createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth: s.username ? { user: s.username, pass: s.password } : undefined,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
}

const address = (name: string, email: string) => (name ? `"${name}" <${email}>` : email);

/** Verify the transport can connect and authenticate (no mail is sent). Never throws. */
export async function verifyTransport(s?: MailSettings): Promise<{ ok: boolean; message: string }> {
  const cfg = s ?? (await loadMailSettings());
  if (!cfg.host) return { ok: false, message: "SMTP host is required" };
  if (!cfg.fromEmail) return { ok: false, message: "A from-address is required" };
  try {
    await transport(cfg).verify();
    return { ok: true, message: `${cfg.host}:${cfg.port} reachable (${cfg.secure ? "implicit TLS" : "STARTTLS"})` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

interface SendInput {
  to: string;
  template: EmailTemplateKey | string;
  vars?: Record<string, string>;
  /** Bypass the "automatic emails disabled" / "template disabled" gates (admin test send). */
  force?: boolean;
}

/** Render the stored template and deliver it, writing one EmailLog row. Never throws. */
export async function sendTemplateMail({
  to,
  template,
  vars = {},
  force = false,
}: SendInput): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!to) return { ok: false, error: "No recipient" };
    const cfg = await loadMailSettings();
    if (!cfg.enabled && !force) return { ok: false, error: "Automatic emails are disabled" };

    const tpl = await prisma.emailTemplate.findUnique({ where: { key: template } });
    if (!tpl) return { ok: false, error: `Unknown template "${template}"` };
    if (!tpl.enabled && !force) return { ok: false, error: `Template "${template}" is disabled` };

    const subject = render(tpl.subject, vars);
    const text = render(tpl.body, vars);

    if (!cfg.host || !cfg.fromEmail) {
      await prisma.emailLog.create({ data: { to, template, subject, status: "FAILED", error: "SMTP not configured" } });
      return { ok: false, error: "SMTP not configured" };
    }

    try {
      await transport(cfg).sendMail({
        from: address(cfg.fromName, cfg.fromEmail),
        to,
        replyTo: cfg.replyTo || undefined,
        subject,
        text,
        html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#0f172a">${escapeHtml(text).replace(/\n/g, "<br/>")}</div>`,
      });
      await prisma.emailLog.create({ data: { to, template, subject, status: "SENT" } });
      return { ok: true };
    } catch (err) {
      const message = (err as Error).message || "Send failed";
      await prisma.emailLog.create({ data: { to, template, subject, status: "FAILED", error: message } });
      return { ok: false, error: message };
    }
  } catch (err) {
    // Defensive: a mail failure must never break the caller (a financial mutation).
    console.error("[mailer]", err);
    return { ok: false, error: (err as Error).message };
  }
}

interface CustomInput {
  to: string;
  subject: string;
  body: string;
  vars?: Record<string, string>;
  /** Bypass the "automatic emails disabled" gate (admin-initiated send). */
  force?: boolean;
}

/** Send an arbitrary (non-template) message to one recipient. Still logged to
 *  EmailLog under the "CUSTOM" pseudo-template. Never throws. */
export async function sendCustomMail({
  to,
  subject,
  body,
  vars = {},
  force = false,
}: CustomInput): Promise<{ ok: boolean; error?: string }> {
  const template = "CUSTOM";
  try {
    if (!to) return { ok: false, error: "No recipient" };
    const cfg = await loadMailSettings();
    if (!cfg.enabled && !force) return { ok: false, error: "Automatic emails are disabled" };

    const subj = render(subject, vars);
    const text = render(body, vars);

    if (!cfg.host || !cfg.fromEmail) {
      await prisma.emailLog.create({ data: { to, template, subject: subj, status: "FAILED", error: "SMTP not configured" } });
      return { ok: false, error: "SMTP not configured" };
    }

    try {
      await transport(cfg).sendMail({
        from: address(cfg.fromName, cfg.fromEmail),
        to,
        replyTo: cfg.replyTo || undefined,
        subject: subj,
        text,
        html: `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#0f172a">${escapeHtml(text).replace(/\n/g, "<br/>")}</div>`,
      });
      await prisma.emailLog.create({ data: { to, template, subject: subj, status: "SENT" } });
      return { ok: true };
    } catch (err) {
      const message = (err as Error).message || "Send failed";
      await prisma.emailLog.create({ data: { to, template, subject: subj, status: "FAILED", error: message } });
      return { ok: false, error: message };
    }
  } catch (err) {
    console.error("[mailer]", err);
    return { ok: false, error: (err as Error).message };
  }
}

/** Load a user's email + name and send them the given automatic template. */
export async function sendAutoEmail(
  template: EmailTemplateKey,
  userId: string,
  vars: Record<string, string> = {},
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, fullName: true } });
  if (!user?.email) return; // nothing to send to
  const name = user.fullName.split(" ")[0] || user.fullName;
  await sendTemplateMail({ to: user.email, template, vars: { name, email: user.email, ...vars } });
}
