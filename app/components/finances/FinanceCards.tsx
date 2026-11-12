"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Plus, Pencil, ChevronDown, ChevronRight, CheckCircle2, Undo2, Loader2, X, Trash2 } from "lucide-react";
import { deleteCreditCard, getCreditCardsOverview, payInvoice, saveCreditCard, setInvoiceTotal } from "@/app/actions";
import { invoiceLabel } from "@/lib/invoice";
import { brl, fmtDate, moneyToInput, parseMoney } from "./format";
import { Bar, EmptyState, Panel } from "./ui";

type Cards = Awaited<ReturnType<typeof getCreditCardsOverview>>;
type Card = Cards[number];
type Invoice = Card["invoices"][number];

const STATUS: Record<string, { label: string; cls: string }> = {
  PAGA: { label: "paga", cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  ATRASADA: { label: "atrasada", cls: "text-rose-300 border-rose-500/40 bg-rose-500/10" },
  FECHADA: { label: "fechada · pagar", cls: "text-amber-300 border-amber-500/40 bg-amber-500/10" },
  ABERTA: { label: "aberta", cls: "text-blue-300 border-blue-500/40 bg-blue-500/10" },
  FUTURA: { label: "futura", cls: "text-slate-400 border-slate-700 bg-slate-800/40" },
};

interface Props {
  /** Abre o formulário de compra no cartão */
  onNewPurchase: (creditCardId: string) => void;
  /** Avisa o Hub que algo mudou (recarrega saldos) */
  onChanged: (message: string) => void;
  /** Muda quando algo fora desta aba mudou */
  refreshKey?: number;
}

export function FinanceCards({ onNewPurchase, onChanged, refreshKey }: Props) {
  const [cards, setCards] = useState<Cards | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<Card | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<{ key: string; value: string } | null>(null);

  async function saveTotal(inv: Invoice, raw: string) {
    if (!card) return;
    const v = parseMoney(raw);
    if (!(v >= 0)) return;
    setBusy(inv.key);
    try {
      await setInvoiceTotal(card.id, inv.key, v);
      setAdjusting(null);
      await load();
      onChanged(`Fatura de ${invoiceLabel(inv.key)} ajustada para ${brl(v)}`);
    } finally {
      setBusy(null);
    }
  }

  const load = useCallback(async () => {
    const data = await getCreditCardsOverview();
    setCards(data);
    setSelected((s) => (s && data.some((c) => c.id === s) ? s : data[0]?.id ?? null));
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const card = cards?.find((c) => c.id === selected) ?? null;

  async function pay(inv: Invoice, paid: boolean) {
    if (!card) return;
    setBusy(inv.key);
    try {
      await payInvoice(card.id, inv.key, paid);
      await load();
      onChanged(paid ? `Fatura de ${invoiceLabel(inv.key)} paga` : `Fatura de ${invoiceLabel(inv.key)} reaberta`);
    } finally {
      setBusy(null);
    }
  }

  if (!cards) {
    return <div className="py-16 flex justify-center text-slate-500"><Loader2 className="animate-spin" size={18} /></div>;
  }

  return (
    <div className="space-y-4">
      {/* CARTÕES */}
      <div className="flex flex-wrap items-center gap-2">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelected(c.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
              selected === c.id ? "bg-slate-800 text-white" : "border-slate-800 text-slate-400 hover:text-white"
            }`}
            style={{ borderColor: selected === c.id ? c.color : undefined }}
          >
            <CreditCard size={14} style={{ color: c.color }} /> {c.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-700 text-xs text-slate-400 hover:text-white cursor-pointer"
        >
          <Plus size={13} /> Cartão
        </button>
      </div>

      {!card ? (
        <Panel>
          <EmptyState>
            Cadastre seu cartão com o dia de fechamento e de vencimento.<br />
            Depois é só lançar a compra: ela cai sozinha na fatura certa.
          </EmptyState>
        </Panel>
      ) : (
        <>
          {/* RESUMO DO CARTÃO */}
          <div className="rounded-2xl border border-slate-800 bg-[#0a0f1d] p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-white">
                  <CreditCard size={16} style={{ color: card.color }} /> {card.name}
                  <button type="button" onClick={() => setEditing(card)} className="p-1 text-slate-500 hover:text-white cursor-pointer" aria-label="Editar cartão">
                    <Pencil size={12} />
                  </button>
                </p>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                  fecha dia {card.closingDay} · vence dia {card.dueDay} · compra hoje cai na fatura de <b className="text-slate-300">{invoiceLabel(card.currentKey)}</b>
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNewPurchase(card.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 cursor-pointer"
              >
                <Plus size={14} /> Nova compra
              </button>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-slate-400">Limite usado (tudo que ainda não foi pago)</span>
                <span className="text-white font-bold">
                  {brl(card.used)}{card.limit ? <span className="text-slate-500 font-normal"> de {brl(card.limit)}</span> : null}
                </span>
              </div>
              {card.limit ? (
                <>
                  <Bar value={card.used} max={card.limit} color={card.color} over={card.used > card.limit} />
                  <p className={`text-[11px] font-mono ${card.available! < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    disponível {brl(card.available!)}
                  </p>
                </>
              ) : (
                <p className="text-[10px] font-mono text-slate-500">Informe o limite no lápis do cartão pra ver quanto sobra.</p>
              )}
            </div>
          </div>

          {/* FATURAS */}
          <Panel title="Faturas" icon={<CreditCard size={14} className="text-amber-400" />}>
            <div className="space-y-1.5">
              {card.invoices.map((inv) => {
                const st = STATUS[inv.status];
                const isOpen = open === `${card.id}-${inv.key}`;
                return (
                  <div key={inv.key} className={`rounded-xl border ${inv.isCurrent ? "border-blue-500/40" : "border-slate-800"} bg-[#050811]`}>
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : `${card.id}-${inv.key}`)}
                        className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer"
                        aria-expanded={isOpen}
                      >
                        {isOpen ? <ChevronDown size={14} className="text-slate-500 shrink-0" /> : <ChevronRight size={14} className="text-slate-500 shrink-0" />}
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white capitalize">{invoiceLabel(inv.key)}</span>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                          </span>
                          <span className="block text-[10px] font-mono text-slate-500">
                            fecha {fmtDate(inv.closingDate)} · vence {fmtDate(inv.dueDate)} · {inv.items.length} lançamento(s)
                          </span>
                        </span>
                      </button>
                      {adjusting?.key === inv.key ? (
                        <span className="flex items-center gap-1 shrink-0">
                          <input
                            autoFocus
                            inputMode="decimal"
                            value={adjusting.value}
                            onChange={(e) => setAdjusting({ key: inv.key, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void saveTotal(inv, adjusting.value);
                              if (e.key === "Escape") setAdjusting(null);
                            }}
                            className="w-24 bg-[#0a0f1d] border border-amber-500/50 rounded px-2 py-1 text-xs text-white font-mono text-right outline-none"
                            aria-label="Total da fatura no banco"
                          />
                          <button type="button" disabled={busy === inv.key} onClick={() => void saveTotal(inv, adjusting.value)}
                            className="px-2 py-1 rounded bg-amber-500 text-slate-950 text-[10px] font-bold disabled:opacity-50 cursor-pointer">ok</button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setAdjusting({ key: inv.key, value: moneyToInput(inv.total) })}
                          className={`text-sm font-bold font-mono shrink-0 hover:underline decoration-dotted cursor-pointer ${inv.paid ? "text-slate-500" : "text-white"}`}
                          title="Ajustar o total pelo valor do banco"
                        >
                          {brl(inv.total)}
                        </button>
                      )}
                      {inv.items.length > 0 &&
                        (inv.paid ? (
                          <button type="button" disabled={busy === inv.key} onClick={() => void pay(inv, false)}
                            className="p-1.5 text-slate-500 hover:text-white disabled:opacity-50 cursor-pointer" title="Reabrir fatura" aria-label="Reabrir fatura">
                            <Undo2 size={14} />
                          </button>
                        ) : (
                          <button type="button" disabled={busy === inv.key} onClick={() => void pay(inv, true)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-500/40 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/10 disabled:opacity-50 cursor-pointer">
                            <CheckCircle2 size={12} /> Pagar
                          </button>
                        ))}
                    </div>
                    {isOpen && (
                      <div className="border-t border-slate-800/80 divide-y divide-slate-800/60">
                        {inv.items.length === 0 && <p className="px-4 py-3 text-xs text-slate-500 font-mono">Nenhuma compra nesta fatura ainda.</p>}
                        {inv.items.map((t) => (
                          <div key={t.id} className="flex items-center gap-3 px-4 py-2 text-xs">
                            <span className="w-11 shrink-0 font-mono text-slate-500">{t.purchaseDate ? fmtDate(t.purchaseDate) : "—"}</span>
                            <span className="flex-1 min-w-0">
                              <span className={`block truncate ${t.paid ? "text-slate-500" : "text-slate-200"}`}>{t.description}</span>
                              <span className="block text-[10px] text-slate-500 truncate">{t.category}{t.notes ? ` · ${t.notes}` : ""}</span>
                            </span>
                            <span className={`font-mono font-bold shrink-0 ${t.type === "INCOME" ? "text-emerald-400" : t.paid ? "text-slate-500" : "text-slate-100"}`}>
                              {t.type === "INCOME" ? "+" : "−"} {brl(t.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        </>
      )}

      {editing && (
        <CardModal
          card={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            await load();
            onChanged(msg);
          }}
        />
      )}
    </div>
  );
}

const COLORS = ["#8B5CF6", "#3B82F6", "#06B6D4", "#10B981", "#F59E0B", "#EC4899", "#F43F5E", "#64748B"];

function CardModal({ card, onClose, onSaved }: { card: Card | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const [name, setName] = useState(card?.name ?? "");
  const [closingDay, setClosingDay] = useState(String(card?.closingDay ?? ""));
  const [dueDay, setDueDay] = useState(String(card?.dueDay ?? ""));
  const [limit, setLimit] = useState(moneyToInput(card?.limit));
  const [color, setColor] = useState(card?.color ?? COLORS[0]);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim() || !Number(closingDay) || !Number(dueDay)) return setError("Preencha nome, dia de fechamento e dia de vencimento.");
    try {
      await saveCreditCard({
        id: card?.id, name, closingDay: Number(closingDay), dueDay: Number(dueDay),
        limit: limit.trim() ? parseMoney(limit) : null, color,
      });
      onSaved(card ? "Cartão atualizado" : "Cartão criado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    }
  }

  const input = "w-full bg-[#050811] border border-slate-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500";
  const label = "text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">{card ? "Editar cartão" : "Novo cartão"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar"><X size={18} /></button>
        </div>
        <div>
          <label className={label}>Nome</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nubank" className={input} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={label}>Fecha dia</label>
            <input type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} placeholder="4" className={input} />
          </div>
          <div>
            <label className={label}>Vence dia</label>
            <input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="11" className={input} />
          </div>
          <div>
            <label className={label}>Limite</label>
            <input inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="opcional" className={`${input} font-mono`} />
          </div>
        </div>
        <p className="text-[10px] font-mono text-slate-500">
          O dia de fechamento está no app do banco (&quot;melhor dia de compra&quot; = dia do fechamento). Compra nesse dia ou depois vai pra fatura seguinte.
        </p>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Cor ${c}`}
              className={`w-7 h-7 rounded-full cursor-pointer ${color === c ? "ring-2 ring-white ring-offset-2 ring-offset-[#0a0f1d]" : ""}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          {card && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm(`Excluir o cartão "${card.name}"? As compras continuam lançadas, só ficam sem cartão.`)) return;
                await deleteCreditCard(card.id);
                onSaved("Cartão excluído");
              }}
              className="mr-auto p-2 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 cursor-pointer"
              aria-label="Excluir cartão"
            >
              <Trash2 size={15} />
            </button>
          )}
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-800 text-xs text-slate-400 cursor-pointer">Cancelar</button>
          <button type="button" onClick={() => void save()} className="px-5 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold cursor-pointer">Salvar</button>
        </div>
      </div>
    </div>
  );
}
