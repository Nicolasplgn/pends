// Leitura de extratos/faturas: OFX (todos os bancos) e CSV (Nubank, Inter, genérico).
// Convenção de saída: amount sempre positivo + type INCOME/EXPENSE.

export interface ParsedRow {
  key: string;
  date: string; // yyyy-mm-dd
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  externalId?: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  format: "OFX" | "CSV";
  /** Arquivo parece fatura de cartão (valores positivos = gastos) */
  looksLikeCard: boolean;
  warnings: string[];
}

function toIsoDate(raw: string): string | null {
  const s = raw.trim().replace(/"/g, "");
  let m = s.match(/^(\d{4})(\d{2})(\d{2})/); // OFX 20261107...
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

function toNumber(raw: string): number {
  let s = raw.trim().replace(/"/g, "").replace(/R\$\s?/i, "").replace(/\s/g, "");
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  return parseFloat(s);
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (c === sep && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function parseOfx(text: string): ParseResult {
  const rows: ParsedRow[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (b: string, name: string) => {
    const m = b.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"));
    return m ? m[1].trim() : "";
  };
  const isCard = /<CCSTMTRS>|<CREDITCARDMSGSRSV1>/i.test(text);
  blocks.forEach((b, i) => {
    const date = toIsoDate(tag(b, "DTPOSTED"));
    const amt = toNumber(tag(b, "TRNAMT"));
    const desc = tag(b, "MEMO") || tag(b, "NAME") || "Sem descrição";
    if (!date || isNaN(amt) || amt === 0) return;
    rows.push({
      key: `ofx-${i}`,
      date,
      description: desc,
      amount: Math.abs(amt),
      type: amt < 0 ? "EXPENSE" : "INCOME",
      externalId: tag(b, "FITID") || undefined,
    });
  });
  return { rows, format: "OFX", looksLikeCard: isCard, warnings: rows.length ? [] : ["Nenhuma transação encontrada no OFX."] };
}

function parseCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const warnings: string[] = [];
  if (lines.length < 2) return { rows: [], format: "CSV", looksLikeCard: false, warnings: ["Arquivo vazio."] };

  const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitCsvLine(lines[0], sep).map(norm);

  const find = (...names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const iDate = find("data", "date");
  const iDesc = find("descricao", "title", "historico", "lancamento", "estabelecimento", "description", "memo");
  const iAmount = find("valor", "amount", "value");
  const iId = find("identificador", "id");

  if (iDate < 0 || iAmount < 0) {
    return { rows: [], format: "CSV", looksLikeCard: false, warnings: ["Não encontrei as colunas de data e valor no CSV."] };
  }

  // Fatura Nubank: colunas date,title,amount — positivo = gasto
  const looksLikeCard = header.includes("title") && header.includes("amount");

  const rows: ParsedRow[] = [];
  lines.slice(1).forEach((line, i) => {
    const cols = splitCsvLine(line, sep);
    const date = toIsoDate(cols[iDate] ?? "");
    const amt = toNumber(cols[iAmount] ?? "");
    if (!date || isNaN(amt) || amt === 0) return;
    rows.push({
      key: `csv-${i}`,
      date,
      description: (iDesc >= 0 ? cols[iDesc] : "") || "Sem descrição",
      amount: Math.abs(amt),
      type: looksLikeCard ? (amt > 0 ? "EXPENSE" : "INCOME") : amt < 0 ? "EXPENSE" : "INCOME",
      externalId: iId >= 0 ? cols[iId] : undefined,
    });
  });
  if (rows.length === 0) warnings.push("Nenhuma linha válida encontrada.");
  return { rows, format: "CSV", looksLikeCard, warnings };
}

export function parseStatement(text: string): ParseResult {
  if (/<OFX>|<STMTTRN>/i.test(text)) return parseOfx(text);
  return parseCsv(text);
}

/** Para fatura de cartão: positivo vira gasto (inverte a convenção de extrato). */
export function flipTypes(rows: ParsedRow[]): ParsedRow[] {
  return rows.map((r) => ({ ...r, type: r.type === "INCOME" ? "EXPENSE" : "INCOME" }));
}
