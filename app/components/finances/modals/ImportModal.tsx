"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Module } from "@prisma/client";
import { X, Upload, FileText, AlertTriangle, Sparkles, CreditCard, Landmark } from "lucide-react";
import { analyzeImport, importTransactions, listCreditCards } from "@/app/actions";
import { invoiceFor, invoiceLabel, monthKey } from "@/lib/invoice";
import type { PayMethod } from "../../../types";
import { PAY_METHOD_LABEL } from "../../../types";
import { parseStatement, flipTypes, type ParsedRow } from "../importParser";
import { brl, fmtDate } from "../format";

interface Row extends ParsedRow {
  category: string;
  suggested: boolean;
  duplicate: boolean;
  selected: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
  modules: Module[];
}

export function ImportModal({ isOpen, onClose, onImported, modules }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [mode, setMode] = useState<"ACCOUNT" | "CARD">("ACCOUNT");
  const [method, setMethod] = useState<PayMethod>("PIX");
  const [invoiceDue, setInvoiceDue] = useState("");
  const [cards, setCards] = useState<Awaited<ReturnType<typeof listCreditCards>>>([]);
  const [creditCardId, setCreditCardId] = useState("");
  // "" = cada compra cai na fatura pela data dela · "2026-12" = tudo nessa fatura
  const [invoiceMonth, setInvoiceMonth] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    listCreditCards()
      .then((list) => {
        if (!alive) return;
        const active = list.filter((c) => c.active);
        setCards(active);
        setCreditCardId((id) => id || active[0]?.id || "");
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [isOpen]);

  const now = new Date();
  const monthOptions = Array.from({ length: 8 }, (_, i) => monthKey(now.getFullYear(), now.getMonth() - 2 + i));
  const [busy, setBusy] = useState(false);

  const defaultCat = modules[0]?.title ?? "Geral";

  function reset() {
    setRows([]);
    setWarnings([]);
    setFileName("");
    setInvoiceDue("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = parseStatement(text);
      setFileName(file.name);
      setWarnings(parsed.warnings);
      const card = parsed.looksLikeCard;
      setMode(card ? "CARD" : "ACCOUNT");
      setMethod(card ? "CREDIT_CARD" : "PIX");
      const base = parsed.rows;
      const hints = await analyzeImport(base);
      setRows(
        base.map((r) => ({
          ...r,
          category: hints[r.key]?.category ?? defaultCat,
          suggested: !!hints[r.key]?.category,
          duplicate: !!hints[r.key]?.duplicate,
          selected: !hints[r.key]?.duplicate,
        }))
      );
    } catch (err) {
      setWarnings([err instanceof Error ? err.message : "Não consegui ler o arquivo."]);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: "ACCOUNT" | "CARD") {
    if (next === mode) return;
    setMode(next);
    setMethod(next === "CARD" ? "CREDIT_CARD" : "PIX");
    setRows((rs) => flipTypes(rs).map((r, i) => ({ ...rs[i], type: r.type })));
  }

  const chosen = rows.filter((r) => r.selected);
  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const r of chosen) {
      if (r.type === "INCOME") inc += r.amount;
      else exp += r.amount;
    }
    return { inc, exp };
  }, [chosen]);

  async function handleImport() {
    if (!chosen.length) return;
    setBusy(true);
    try {
      const res = await importTransactions(
        chosen.map(({ key, date, description, amount, type, category }) => ({ key, date, description, amount, type, category })),
        {
          paymentMethod: method,
          // Extrato da conta = já aconteceu. Fatura = a pagar no vencimento.
          paid: mode === "ACCOUNT",
          dueDate: mode === "CARD" && invoiceDue ? invoiceDue : null,
          creditCardId: mode === "CARD" && creditCardId ? creditCardId : null,
          invoiceMonth: mode === "CARD" && creditCardId && invoiceMonth ? invoiceMonth : null,
        }
      );
      onImported(res.created);
      reset();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  if (!isOpen) return null;

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-3xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-slate-800 bg-[#0a0f1d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wider font-mono">
            <Upload size={15} className="text-blue-400" /> Importar extrato / fatura
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {rows.length === 0 ? (
            <label
              className="flex flex-col items-center justify-center gap-2 py-12 rounded-2xl border-2 border-dashed border-slate-700 hover:border-blue-500/60 hover:bg-blue-500/5 cursor-pointer text-center"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) void handleFile(f);
              }}
            >
              <FileText size={28} className="text-slate-500" />
              <span className="text-sm text-slate-200 font-semibold">{busy ? "Lendo arquivo..." : "Arraste o arquivo ou clique para escolher"}</span>
              <span className="text-[11px] text-slate-500 font-mono">OFX de qualquer banco · CSV do Nubank, Inter e similares</span>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.ofx,.txt,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
              />
            </label>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-mono text-slate-400 truncate">
                  {fileName} · {rows.length} linhas
                </span>
                <button onClick={reset} className="text-slate-500 hover:text-white text-[11px] cursor-pointer">trocar arquivo</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="grid grid-cols-2 gap-1 sm:col-span-2">
                  {([
                    ["ACCOUNT", "Extrato da conta", <Landmark size={13} key="a" />],
                    ["CARD", "Fatura do cartão", <CreditCard size={13} key="c" />],
                  ] as const).map(([m, label, icon]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => switchMode(m)}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-[11px] font-bold cursor-pointer ${
                        mode === m ? "border-blue-500/60 bg-blue-500/10 text-blue-200" : "border-slate-800 text-slate-500"
                      }`}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PayMethod)}
                  className="bg-[#050811] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white outline-none"
                >
                  {Object.entries(PAY_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              {mode === "CARD" && cards.length > 0 ? (
                <div className="space-y-2 text-[11px] text-slate-400 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Cartão:</span>
                    {cards.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCreditCardId(c.id)}
                        className={`px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${
                          creditCardId === c.id ? "text-white bg-slate-800 font-bold" : "border-slate-800 text-slate-400"
                        }`}
                        style={{ borderColor: creditCardId === c.id ? c.color : undefined }}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Fatura:</span>
                    <select
                      value={invoiceMonth}
                      onChange={(e) => setInvoiceMonth(e.target.value)}
                      className="bg-[#050811] border border-slate-700 rounded px-2 py-1 text-white text-xs outline-none"
                    >
                      <option value="">Pela data de cada compra</option>
                      {monthOptions.map((k) => <option key={k} value={k}>Tudo na fatura de {invoiceLabel(k)}</option>)}
                    </select>
                  </div>
                  <p>
                    Compras entram <b className="text-amber-300">a pagar</b> no cartão. Se o arquivo é a fatura de um mês só, escolha o mês
                    (assim parcelas antigas que aparecem nela não vão pra fatura errada).
                    {!invoiceMonth && rows[0] && cards.find((c) => c.id === creditCardId) && (
                      <> Ex.: compra de {fmtDate(`${rows[0].date}T12:00:00Z`)} cai em{" "}
                        <b className="text-amber-200">
                          {invoiceLabel(invoiceFor(cards.find((c) => c.id === creditCardId)!, new Date(`${rows[0].date}T12:00:00Z`)).invoiceMonth)}
                        </b>.
                      </>
                    )}
                  </p>
                </div>
              ) : mode === "CARD" ? (
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                  Compras entram <b className="text-amber-300">a pagar</b>. Vencimento da fatura:
                  <input
                    type="date"
                    value={invoiceDue}
                    onChange={(e) => setInvoiceDue(e.target.value)}
                    className="bg-[#050811] border border-slate-700 rounded px-2 py-1 text-white scheme-dark"
                  />
                  <span className="text-slate-500">(vazio = data de cada compra)</span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
                  Movimentações do extrato entram como <b className="text-emerald-300">já pagas/recebidas</b>.
                </p>
              )}

              {rows.some((r) => r.duplicate) && (
                <p className="flex items-center gap-2 text-[11px] text-amber-300">
                  <AlertTriangle size={13} /> {rows.filter((r) => r.duplicate).length} parecem já lançadas (mesmo valor e data) e vieram desmarcadas.
                </p>
              )}

              <div className="rounded-xl border border-slate-800 divide-y divide-slate-800/80 max-h-[45vh] overflow-y-auto">
                {rows.map((r) => (
                  <div key={r.key} className={`flex items-center gap-2 px-3 py-2 text-xs ${r.selected ? "" : "opacity-45"}`}>
                    <input
                      type="checkbox"
                      checked={r.selected}
                      onChange={() => update(r.key, { selected: !r.selected })}
                      className="accent-blue-500 shrink-0"
                      aria-label="Importar esta linha"
                    />
                    <span className="font-mono text-slate-500 w-11 shrink-0">{fmtDate(`${r.date}T12:00:00Z`)}</span>
                    <span className="flex-1 min-w-0 truncate text-slate-200" title={r.description}>
                      {r.description}
                      {r.duplicate && <span className="ml-1.5 text-[9px] text-amber-400 font-mono">duplicado?</span>}
                    </span>
                    <select
                      value={r.category}
                      onChange={(e) => update(r.key, { category: e.target.value, suggested: false })}
                      className={`hidden sm:block w-32 bg-[#050811] border rounded px-1.5 py-1 text-[11px] text-white outline-none ${
                        r.suggested ? "border-violet-500/50" : "border-slate-800"
                      }`}
                      title={r.suggested ? "Sugerido pelo seu histórico" : undefined}
                    >
                      {modules.map((m) => <option key={m.id} value={m.title}>{m.title}</option>)}
                      {!modules.some((m) => m.title === r.category) && <option value={r.category}>{r.category}</option>}
                    </select>
                    <button
                      type="button"
                      onClick={() => update(r.key, { type: r.type === "INCOME" ? "EXPENSE" : "INCOME" })}
                      className={`w-24 text-right font-mono font-bold shrink-0 cursor-pointer ${r.type === "INCOME" ? "text-emerald-400" : "text-slate-100"}`}
                      title="Clique para inverter entrada/saída"
                    >
                      {r.type === "INCOME" ? "+" : "−"} {brl(r.amount)}
                    </button>
                  </div>
                ))}
              </div>

              <p className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                <Sparkles size={11} className="text-violet-400" /> borda roxa = módulo sugerido pelo seu histórico · clique no valor para inverter entrada/saída
              </p>
            </>
          )}

          {warnings.map((w) => (
            <p key={w} className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{w}</p>
          ))}
        </div>

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-t border-slate-800">
            <span className="text-[11px] font-mono text-slate-400">
              {chosen.length} selecionadas · <span className="text-rose-400">{brl(totals.exp)}</span> saídas ·{" "}
              <span className="text-emerald-400">{brl(totals.inc)}</span> entradas
            </span>
            <button
              type="button"
              disabled={busy || chosen.length === 0}
              onClick={() => void handleImport()}
              className="px-5 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
            >
              {busy ? "Importando..." : `Importar ${chosen.length}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
