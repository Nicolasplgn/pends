// Regra da fatura do cartão (usada no servidor e na tela, pra prévia e gravação baterem).
// Datas no padrão do app: meio-dia UTC.

export interface CardCycle {
  closingDay: number; // dia em que a fatura fecha
  dueDay: number; // dia de vencimento
}

const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** "2026-12" a partir de ano e mês (0-11), normalizando estouro de mês. */
export function monthKey(year: number, month: number) {
  const d = new Date(Date.UTC(year, month, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(key: string) {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m - 1 };
}

/** Vencimento da fatura de um mês ("2026-12" → 11/12/2026 ao meio-dia UTC). */
export function invoiceDueDate(card: CardCycle, key: string) {
  const { year, month } = parseMonthKey(key);
  return new Date(Date.UTC(year, month, Math.min(card.dueDay, lastDay(year, month)), 12));
}

/** Dia em que a fatura de um mês fecha. */
export function invoiceClosingDate(card: CardCycle, key: string) {
  const { year, month } = parseMonthKey(key);
  // Se vence antes (ou no) dia do fechamento, ela fechou no mês anterior
  const closeMonth = card.dueDay > card.closingDay ? month : month - 1;
  const d = new Date(Date.UTC(year, closeMonth, 1));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), Math.min(card.closingDay, lastDay(d.getUTCFullYear(), d.getUTCMonth())), 12));
}

/**
 * Em qual fatura cai uma compra.
 * Comprou no dia do fechamento ou depois → vai para a fatura seguinte.
 * `parcel` = 0 para a 1ª parcela, 1 para a 2ª… (cada parcela anda uma fatura).
 */
export function invoiceFor(card: CardCycle, purchase: Date, parcel = 0) {
  const y = purchase.getUTCFullYear();
  const m = purchase.getUTCMonth();
  const day = purchase.getUTCDate();
  const closeMonth = day >= card.closingDay ? m + 1 : m; // mês em que esta compra "fecha"
  const dueMonth = card.dueDay > card.closingDay ? closeMonth : closeMonth + 1;
  const key = monthKey(y, dueMonth + parcel);
  return { invoiceMonth: key, dueDate: invoiceDueDate(card, key) };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "dez/26" */
export function invoiceLabel(key: string) {
  const { year, month } = parseMonthKey(key);
  return `${MESES[month]}/${String(year).slice(2)}`;
}
