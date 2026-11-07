// Helpers de formatação do Hub Financeiro.
// Datas financeiras são gravadas ao meio-dia UTC → sempre ler/exibir em UTC.

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** R$ compacto para eixos/gráficos: 1,2k · 15k */
export const brlShort = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${v < 0 ? "-" : ""}R$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(".", ",")}k`;
  return `R$${Math.round(v)}`;
};

export function fmtDate(d: Date | string | null | undefined, withYear = false) {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return withYear ? `${dd}/${mm}/${date.getUTCFullYear()}` : `${dd}/${mm}`;
}

/** yyyy-mm-dd para <input type="date"> */
export function toInputDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export function todayInputDate() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/** Diferença em dias entre o vencimento (UTC) e hoje (local). Negativo = atrasado. */
export function daysUntil(d: Date | string) {
  const due = new Date(d);
  const n = new Date();
  const a = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const b = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
  return Math.round((a - b) / 86400000);
}

export function dueLabel(d: Date | string) {
  const diff = daysUntil(d);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  if (diff < 0) return `${Math.abs(diff)}d atrasada`;
  if (diff <= 7) return `em ${diff}d`;
  return fmtDate(d);
}

/** Aceita "1.234,56", "1234.56", "R$ 50" */
export function parseMoney(raw: string): number {
  let s = String(raw).replace(/[R$\s]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? NaN : Math.round(n * 100) / 100;
}

export function moneyToInput(n: number | null | undefined) {
  if (n === null || n === undefined) return "";
  return n.toFixed(2).replace(".", ",");
}
