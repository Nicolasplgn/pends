// lib/mail.ts
// Envio de e-mail via API HTTP do Resend (https://resend.com) — sem dependência extra.
// Sem RESEND_API_KEY configurada, cai no modo simulação (console.log).

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail({ to, subject, html, text }: MailInput): Promise<{ ok: boolean; simulated?: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[E-MAIL SIMULADO] Para: ${to} · Assunto: ${subject}\n${text ?? html}`);
    return { ok: true, simulated: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.REMINDER_FROM || "Pends <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Falha no envio de e-mail:", res.status, body);
    return { ok: false, error: `Resend ${res.status}` };
  }
  return { ok: true };
}

export function reminderRecipient(): string | null {
  return process.env.REMINDER_TO || process.env.AUTH_EMAIL || null;
}
