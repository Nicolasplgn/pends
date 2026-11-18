// lib/pends/queries.ts
// Consultas e comandos usados pelo MCP, montados em cima do core (lib/pends/core.ts).
// Sem autenticação aqui: quem chama (rota /api/mcp) já validou o token.

import { prisma } from "../prisma";
import {
  createCardCore, createTransactionCore, getTodayOverviewCore, monthRange, round2, todayMidday,
  toggleCardCompletionCore, updateCardDetailsCore, type PayMethod, type TxType,
} from "./core";

/** Referência curta e opaca do card (não expõe o id interno inteiro). */
export const shortRef = (id: string) => id.slice(0, 8);

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/** Resolve a referência curta para o id real; erro se não achar ou se for ambígua. */
export async function resolveCardRef(ref: string) {
  const clean = ref.trim().toLowerCase();
  if (!/^[0-9a-f-]{6,36}$/.test(clean)) throw new Error("Referência de pendência inválida.");
  const found = await prisma.card.findMany({ where: { id: { startsWith: clean } }, select: { id: true }, take: 2 });
  if (found.length === 0) throw new Error("Pendência não encontrada.");
  if (found.length > 1) throw new Error("Referência ambígua: use mais caracteres do id.");
  return found[0].id;
}

async function moduleIdByName(name?: string | null) {
  if (!name?.trim()) return null;
  const m = await prisma.module.findFirst({ where: { title: { equals: name.trim(), mode: "insensitive" } } });
  if (!m) {
    const all = await prisma.module.findMany({ select: { title: true } });
    throw new Error(`Módulo "${name}" não existe. Use um destes: ${all.map((x) => x.title).join(", ")}.`);
  }
  return m.id;
}

async function projectIdByName(name?: string | null) {
  if (!name?.trim()) return null;
  const p = await prisma.project.findFirst({ where: { title: { equals: name.trim(), mode: "insensitive" } } });
  if (!p) throw new Error(`Projeto "${name}" não existe.`);
  return p.id;
}

function cardView(c: {
  id: string; title: string; priority: string; dueDate: Date | null; completed: boolean; assignee: string | null;
  checklist: unknown; description: string | null;
  column: { title: string }; module: { title: string } | null; project: { title: string } | null;
}, withDescription = false) {
  const list = (c.checklist as { done: boolean }[] | null) ?? [];
  return {
    id: shortRef(c.id),
    titulo: c.title,
    etapa: c.column.title,
    modulo: c.module?.title ?? null,
    projeto: c.project?.title ?? null,
    prioridade: c.priority,
    prazo: iso(c.dueDate),
    com: c.assignee ?? "comigo",
    concluida: c.completed,
    checklist: list.length ? `${list.filter((i) => i.done).length}/${list.length}` : null,
    ...(withDescription && c.description ? { descricao: c.description.slice(0, 500) } : {}),
  };
}

const cardSelect = {
  id: true, title: true, priority: true, dueDate: true, completed: true, assignee: true, checklist: true, description: true,
  column: { select: { title: true, isDone: true } },
  module: { select: { title: true } },
  project: { select: { title: true } },
} as const;

export async function listCards(f: {
  status: "abertas" | "concluidas" | "todas";
  modulo?: string;
  prazoDe?: string;
  prazoAte?: string;
  texto?: string;
  limite: number;
}) {
  const where: Record<string, unknown> = {};
  if (f.status === "abertas") Object.assign(where, { completed: false, column: { isDone: false } });
  if (f.status === "concluidas") Object.assign(where, { OR: [{ completed: true }, { column: { isDone: true } }] });
  if (f.modulo) where.module = { title: { contains: f.modulo, mode: "insensitive" } };
  if (f.prazoDe || f.prazoAte) {
    where.dueDate = {
      ...(f.prazoDe ? { gte: new Date(`${f.prazoDe}T00:00:00Z`) } : {}),
      ...(f.prazoAte ? { lte: new Date(`${f.prazoAte}T23:59:59Z`) } : {}),
    };
  }
  if (f.texto) {
    const t = { contains: f.texto, mode: "insensitive" };
    where.AND = [{ OR: [{ title: t }, { description: t }] }];
  }
  const [rows, total] = await Promise.all([
    prisma.card.findMany({ where, select: cardSelect, orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { order: "asc" }], take: f.limite }),
    prisma.card.count({ where }),
  ]);
  return { total, mostrando: rows.length, pendencias: rows.map((c) => cardView(c)) };
}

export async function createCardFromTool(i: {
  titulo: string; descricao?: string; modulo?: string; prioridade?: string; prazo?: string; projeto?: string;
}) {
  const col =
    (await prisma.column.findFirst({ where: { kind: "TODO" }, orderBy: { order: "asc" } })) ??
    (await prisma.column.findFirst({ where: { isDone: false }, orderBy: { order: "asc" } }));
  if (!col) throw new Error("O quadro não tem etapas.");
  const [moduleId, projectId] = await Promise.all([moduleIdByName(i.modulo), projectIdByName(i.projeto)]);
  await createCardCore(col.id, i.titulo, moduleId ?? "", i.prioridade ?? "Normal", i.descricao ?? "", i.prazo ?? "", projectId);
  const card = await prisma.card.findFirst({ where: { columnId: col.id, title: i.titulo }, orderBy: { createdAt: "desc" }, select: cardSelect });
  return card ? cardView(card, true) : null;
}

export async function updateCardFromTool(ref: string, i: {
  titulo?: string; descricao?: string; modulo?: string; prioridade?: string; prazo?: string | null;
}) {
  const id = await resolveCardRef(ref);
  const cur = await prisma.card.findUnique({ where: { id } });
  if (!cur) throw new Error("Pendência não encontrada.");
  const moduleId = i.modulo !== undefined ? await moduleIdByName(i.modulo) : cur.moduleId;
  await updateCardDetailsCore(
    id,
    i.titulo ?? cur.title,
    i.descricao ?? cur.description ?? "",
    i.prioridade ?? cur.priority,
    i.prazo === null ? "" : i.prazo ?? iso(cur.dueDate) ?? "",
    moduleId ?? ""
  );
  const card = await prisma.card.findUnique({ where: { id }, select: cardSelect });
  return card ? cardView(card, true) : null;
}

/** Conclui (idempotente): só alterna se ainda estiver aberta. */
export async function completeCard(ref: string) {
  const id = await resolveCardRef(ref);
  const cur = await prisma.card.findUnique({ where: { id }, include: { column: true } });
  if (!cur) throw new Error("Pendência não encontrada.");
  const already = cur.completed || cur.column.isDone;
  if (!already) await toggleCardCompletionCore(id);
  const card = await prisma.card.findUnique({ where: { id }, select: cardSelect });
  return { jaEstavaConcluida: already, pendencia: card ? cardView(card) : null };
}

export async function listModules() {
  const mods = await prisma.module.findMany({ orderBy: { createdAt: "asc" } });
  const counts = await prisma.card.groupBy({
    by: ["moduleId"],
    where: { completed: false, column: { isDone: false } },
    _count: { _all: true },
  });
  return mods.map((m) => ({
    nome: m.title,
    cor: m.color,
    tetoMensal: m.budget,
    pendenciasAbertas: counts.find((c) => c.moduleId === m.id)?._count._all ?? 0,
  }));
}

export async function createTransactionFromTool(i: {
  valor: number; tipo: "entrada" | "saida"; categoria: string; data: string; descricao: string;
  forma: "pix" | "boleto" | "debito" | "cartao"; ja_pago?: boolean;
}) {
  const method: PayMethod = { pix: "PIX", boleto: "BOLETO", debito: "DEBIT", cartao: "CREDIT_CARD" }[i.forma] as PayMethod;
  const card = method === "CREDIT_CARD" ? await prisma.creditCard.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } }) : null;
  // Mesma regra da tela: data de hoje/passada = pago; futura = a pagar; cartão = a pagar até pagar a fatura
  const today = new Date().toISOString().slice(0, 10);
  const paid = i.ja_pago ?? (method === "CREDIT_CARD" ? false : i.data <= today);
  const res = await createTransactionCore({
    description: i.descricao,
    amount: i.valor,
    type: (i.tipo === "entrada" ? "INCOME" : "EXPENSE") as TxType,
    category: i.categoria,
    paymentMethod: method,
    dueDate: i.data,
    paid,
    creditCardId: card?.id ?? null,
  });
  return {
    registrado: true,
    descricao: i.descricao,
    valor: round2(i.valor),
    tipo: i.tipo,
    categoria: i.categoria,
    situacao: paid ? (i.tipo === "entrada" ? "recebido" : "pago") : i.tipo === "entrada" ? "a receber" : "a pagar",
    ...(card ? { cartao: card.name } : {}),
    mesDoVencimento: `${String(res.month + 1).padStart(2, "0")}/${res.year}`,
  };
}

export async function financeSummary(de?: string, ate?: string) {
  const now = new Date();
  const range = monthRange(now.getFullYear(), now.getMonth());
  const start = de ? new Date(`${de}T00:00:00Z`) : range.start;
  const end = ate ? new Date(`${ate}T23:59:59Z`) : range.end;
  if (start > end) throw new Error("A data inicial é depois da final.");
  if (end.getTime() - start.getTime() > 400 * 86400000) throw new Error("Período máximo: 13 meses.");

  const txs = await prisma.transaction.findMany({
    where: { dueDate: { gte: start, lte: end } },
    select: { amount: true, type: true, paid: true, category: true, description: true, dueDate: true },
  });
  let entradas = 0, saidas = 0, recebido = 0, pago = 0;
  const porCategoria = new Map<string, number>();
  for (const t of txs) {
    if (t.type === "INCOME") {
      entradas += t.amount;
      if (t.paid) recebido += t.amount;
    } else {
      saidas += t.amount;
      if (t.paid) pago += t.amount;
      porCategoria.set(t.category, (porCategoria.get(t.category) ?? 0) + t.amount);
    }
  }
  const maiores = txs
    .filter((t) => t.type !== "INCOME")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((t) => ({ descricao: t.description, valor: round2(t.amount), vencimento: iso(t.dueDate), pago: t.paid }));
  return {
    periodo: { de: iso(start), ate: iso(end) },
    entradas: round2(entradas),
    saidas: round2(saidas),
    saldo: round2(entradas - saidas),
    jaRecebido: round2(recebido),
    jaPago: round2(pago),
    aPagar: round2(saidas - pago),
    saidasPorCategoria: [...porCategoria.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([categoria, total]) => ({ categoria, total: round2(total) })),
    maioresSaidas: maiores,
    lancamentos: txs.length,
  };
}

export async function daySummary() {
  const data = await getTodayOverviewCore();
  const today = todayMidday().getTime();
  const DAY = 86400000;
  const bucket = (d: Date) => {
    const diff = Math.round((new Date(d).getTime() - today) / DAY);
    return diff < 0 ? "atrasadas" : diff === 0 ? "hoje" : diff <= 7 ? "semana" : null;
  };
  const out = {
    data: iso(todayMidday()),
    pendencias: { atrasadas: [] as unknown[], hoje: [] as unknown[], semana: [] as unknown[] },
    contasAPagar: { atrasadas: [] as unknown[], hoje: [] as unknown[], semana: [] as unknown[] },
    aReceber: [] as unknown[],
    mes: {
      referencia: `${String(data.month.month + 1).padStart(2, "0")}/${data.month.year}`,
      entradas: data.month.income,
      jaRecebido: data.month.incomeReceived,
      saidas: data.month.expense,
      jaPago: data.month.expensePaid,
      saldoPrevisto: data.month.balance,
    },
  };
  for (const c of data.cards) {
    const b = c.dueDate ? bucket(c.dueDate) : null;
    if (!b) continue;
    out.pendencias[b].push({
      id: shortRef(c.id), titulo: c.title, prazo: iso(c.dueDate), prioridade: c.priority,
      modulo: c.module?.title ?? null, etapa: c.column.title, com: c.assignee ?? "comigo",
    });
  }
  for (const t of data.bills) {
    const b = bucket(t.dueDate);
    if (!b) continue;
    out.contasAPagar[b].push({ descricao: t.description, valor: round2(t.amount), vencimento: iso(t.dueDate) });
  }
  for (const t of data.incomes) {
    if (bucket(t.dueDate)) out.aReceber.push({ descricao: t.description, valor: round2(t.amount), previsto: iso(t.dueDate) });
  }
  return out;
}
