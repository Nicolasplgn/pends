// lib/reminders.ts
// Monta o resumo diário: pendências (com alerta ligado) e contas a pagar que vencem até amanhã ou já venceram.

import { prisma } from "./prisma";
import { sendMail, reminderRecipient } from "./mail";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });

/** Datas do app são gravadas ao meio-dia UTC; "hoje" é considerado no fuso de Brasília. */
function brToday() {
  const now = new Date(Date.now() - 3 * 3600_000);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}
function dayDiff(d: Date) {
  return Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - brToday()) / 86400000);
}
function whenLabel(d: Date) {
  const n = dayDiff(d);
  if (n < 0) return `atrasada ${Math.abs(n)}d`;
  if (n === 0) return "hoje";
  return "amanhã";
}

export async function buildDailyDigest() {
  const limit = new Date(brToday() + 2 * 86400000 - 1); // fim de amanhã

  const [cards, txs] = await Promise.all([
    prisma.card.findMany({
      where: { completed: false, emailAlert: true, dueDate: { not: null, lte: limit }, column: { isDone: false } },
      include: { module: true },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    prisma.transaction.findMany({
      where: { paid: false, dueDate: { lte: limit } },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
  ]);

  const expenses = txs.filter((t) => t.type !== "INCOME");
  const incomes = txs.filter((t) => t.type === "INCOME");
  const toPay = expenses.reduce((s, t) => s + t.amount, 0);

  return { cards, expenses, incomes, toPay, empty: cards.length === 0 && txs.length === 0 };
}

export async function sendDailyDigest(opts: { force?: boolean } = {}) {
  const to = reminderRecipient();
  if (!to) return { ok: false, error: "Defina REMINDER_TO ou AUTH_EMAIL." };

  const d = await buildDailyDigest();
  if (d.empty && !opts.force) return { ok: true, skipped: true };

  const row = (left: string, right: string, color: string) =>
    `<tr><td style="padding:6px 0;color:#e2e8f0">${left}</td><td style="padding:6px 0;text-align:right;color:${color};white-space:nowrap">${right}</td></tr>`;

  const section = (title: string, rows: string[]) =>
    rows.length
      ? `<h3 style="margin:20px 0 6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#94a3b8">${title}</h3><table style="width:100%;border-collapse:collapse;font-size:14px">${rows.join("")}</table>`
      : "";

  const html = `
  <div style="background:#050811;padding:24px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#0a0f1d;border:1px solid #1e293b;border-radius:16px;padding:24px">
      <h2 style="margin:0;color:#fff;font-size:18px">☀️ Seu dia no Pends</h2>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px">${d.cards.length} pendência(s) · ${d.expenses.length} conta(s) a pagar${d.toPay ? ` (${brl(d.toPay)})` : ""}</p>
      ${section("Contas a pagar", d.expenses.map((t) => row(`${t.description} <span style="color:#64748b">· ${fmt(t.dueDate)}</span>`, `${brl(t.amount)} · ${whenLabel(t.dueDate)}`, dayDiff(t.dueDate) < 0 ? "#f43f5e" : "#fbbf24")))}
      ${section("A receber", d.incomes.map((t) => row(t.description, `${brl(t.amount)} · ${whenLabel(t.dueDate)}`, "#10b981")))}
      ${section("Pendências", d.cards.map((c) => row(`${c.title}${c.module ? ` <span style="color:#64748b">· ${c.module.title}</span>` : ""}`, whenLabel(c.dueDate!), dayDiff(c.dueDate!) < 0 ? "#f43f5e" : "#fbbf24")))}
      ${d.empty ? `<p style="color:#10b981;margin-top:16px">Nada vencendo hoje ou amanhã. 🎉</p>` : ""}
    </div>
  </div>`;

  const text = [
    `Seu dia no Pends`,
    ...d.expenses.map((t) => `- Pagar ${t.description}: ${brl(t.amount)} (${whenLabel(t.dueDate)})`),
    ...d.incomes.map((t) => `- Receber ${t.description}: ${brl(t.amount)} (${whenLabel(t.dueDate)})`),
    ...d.cards.map((c) => `- ${c.title} (${whenLabel(c.dueDate!)})`),
  ].join("\n");

  const subject = d.empty
    ? "Pends: nada vencendo hoje ✅"
    : `Pends: ${d.expenses.length + d.cards.length} item(ns) pra hoje/amanhã${d.toPay ? ` · ${brl(d.toPay)}` : ""}`;

  const res = await sendMail({ to, subject, html, text });
  return { ...res, counts: { cards: d.cards.length, bills: d.expenses.length } };
}
