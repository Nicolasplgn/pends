"use client";

// Constelação no estilo "graph view" do Obsidian: cada pendência é um nó, ligada
// ao seu módulo, projeto, responsável e às pendências de que depende.
// Simulação de forças própria (sem dependências), desenhada em SVG.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Module } from "@prisma/client";
import { Crosshair, Minus, Plus, Search, X } from "lucide-react";
import type { KanbanColumn, NeuralCard } from "../../types";
import { isCardOverdue } from "../../types";

type Kind = "card" | "module" | "project" | "person";
type EdgeKind = "module" | "project" | "person" | "dep";

interface GNode {
  id: string;
  kind: Kind;
  label: string;
  color: string;
  r: number;
  card?: NeuralCard;
  refId?: string; // id real do módulo/projeto
  overdue?: boolean;
  soon?: boolean;
  important?: boolean;
}

interface GEdge {
  s: string;
  t: string;
  kind: EdgeKind;
}

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  pinned?: boolean;
}

interface NeuralGraphProps {
  modules: Module[];
  columns: KanbanColumn[];
  onCardClick?: (cardId: string) => void;
  onOpenModule?: (moduleId: string) => void;
}

const PRIORITY_R: Record<string, number> = { Urgente: 10, Alta: 8.5, Normal: 7, Baixa: 6 };
const DAY = 86_400_000;

function daysUntil(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  const b = new Date(d);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

const short = (s: string, n = 30) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function NeuralGraph({ modules, columns, onCardClick, onOpenModule }: NeuralGraphProps) {
  const [showDone, setShowDone] = useState(false);
  const [showModules, setShowModules] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [showPeople, setShowPeople] = useState(true);
  const [query, setQuery] = useState("");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  // Retrato das posições/zoom para o render (a simulação roda nos refs)
  const [snap, setSnap] = useState<{ pos: Map<string, { x: number; y: number }>; view: { x: number; y: number; k: number } }>(
    () => ({ pos: new Map(), view: { x: 400, y: 300, k: 1 } })
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const view = useRef({ x: 400, y: 300, k: 1 });
  const bodies = useRef(new Map<string, Body>());
  const alpha = useRef(1);
  const raf = useRef<number | null>(null);

  const publish = useCallback(() => {
    const pos = new Map<string, { x: number; y: number }>();
    for (const [id, b] of bodies.current) pos.set(id, { x: b.x, y: b.y });
    setSnap({ pos, view: { ...view.current } });
  }, []);

  // ---------------- Grafo a partir do quadro ----------------
  const { nodes, edges } = useMemo(() => {
    const nodes: GNode[] = [];
    const edges: GEdge[] = [];
    const modById = new Map(modules.map((m) => [m.id, m]));
    const hubs = new Map<string, GNode>();
    const cardIds = new Set<string>();

    const hub = (id: string, make: () => GNode) => {
      if (!hubs.has(id)) hubs.set(id, make());
      return hubs.get(id)!;
    };

    for (const col of columns) {
      for (const c of col.cards) {
        const done = c.completed || col.isDone;
        if (done && !showDone) continue;
        const mod = c.moduleId ? modById.get(c.moduleId) : undefined;
        const d = daysUntil(c.dueDate);
        const overdue = !done && isCardOverdue(c.dueDate);
        const soon = !done && !overdue && d !== null && d <= 2;
        const urgent = !done && (c.priority === "Urgente" || c.priority === "Alta");
        const id = `c:${c.id}`;
        cardIds.add(c.id);
        nodes.push({
          id,
          kind: "card",
          label: c.title,
          color: done ? "#475569" : mod?.color ?? "#94a3b8",
          r: done ? 5 : PRIORITY_R[c.priority] ?? 7,
          card: { ...c, columnTitle: col.title },
          overdue,
          soon,
          important: overdue || soon || urgent,
        });

        if (showModules && mod) {
          const h = hub(`m:${mod.id}`, () => ({ id: `m:${mod.id}`, kind: "module", label: mod.title, color: mod.color, r: 12, refId: mod.id }));
          edges.push({ s: id, t: h.id, kind: "module" });
        }
        if (showProjects && c.project) {
          const p = c.project;
          const h = hub(`p:${p.id}`, () => ({ id: `p:${p.id}`, kind: "project", label: p.title, color: p.color, r: 9, refId: p.id }));
          edges.push({ s: id, t: h.id, kind: "project" });
        }
        if (showPeople && c.assignee?.trim()) {
          const name = c.assignee.trim();
          const key = `u:${name.toLowerCase()}`;
          const h = hub(key, () => ({ id: key, kind: "person", label: name, color: "#e2e8f0", r: 8 }));
          edges.push({ s: id, t: h.id, kind: "person" });
        }
      }
    }
    // Dependências entre pendências (as duas precisam estar visíveis)
    for (const col of columns) {
      for (const c of col.cards) {
        if (c.blockedById && cardIds.has(c.id) && cardIds.has(c.blockedById)) {
          edges.push({ s: `c:${c.id}`, t: `c:${c.blockedById}`, kind: "dep" });
        }
      }
    }
    nodes.push(...hubs.values());
    return { nodes, edges };
  }, [modules, columns, showDone, showModules, showProjects, showPeople]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const n of nodes) m.set(n.id, new Set());
    for (const e of edges) {
      m.get(e.s)?.add(e.t);
      m.get(e.t)?.add(e.s);
    }
    return m;
  }, [nodes, edges]);

  // ---------------- Simulação ----------------
  const step = useCallback(() => {
    const list = nodes.map((n) => ({ n, b: bodies.current.get(n.id)! })).filter((x) => x.b);
    const a = alpha.current;

    // Repulsão (n²: o quadro tem no máximo algumas centenas de nós)
    for (let i = 0; i < list.length; i++) {
      const A = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const B = list[j];
        let dx = B.b.x - A.b.x;
        let dy = B.b.y - A.b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 0.25; }
        if (d2 > 250_000) continue;
        const hubBoost = (A.n.kind === "card" ? 1 : 2.6) * (B.n.kind === "card" ? 1 : 2.6);
        const d = Math.sqrt(d2);
        // Repulsão + colisão (nós não se sobrepõem; rótulo conta como espaço)
        const minD = A.n.r + B.n.r + (A.n.kind !== "card" && B.n.kind !== "card" ? 90 : 46);
        const f = (1100 * hubBoost * a) / d2 + (d < minD ? (minD - d) * 0.35 : 0);
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        A.b.vx -= fx; A.b.vy -= fy;
        B.b.vx += fx; B.b.vy += fy;
      }
    }
    // Molas nas ligações
    for (const e of edges) {
      const s = bodies.current.get(e.s);
      const t = bodies.current.get(e.t);
      if (!s || !t) continue;
      const dx = t.x - s.x;
      const dy = t.y - s.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const len = e.kind === "dep" ? 70 : e.kind === "module" ? 110 : 140;
      const k = e.kind === "module" ? 0.05 : e.kind === "dep" ? 0.04 : 0.018;
      const f = (d - len) * k * a;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      s.vx += fx; s.vy += fy;
      t.vx -= fx; t.vy -= fy;
    }
    // Gravidade para o centro + atrito
    for (const { b } of list) {
      b.vx -= b.x * 0.012 * a;
      b.vy -= b.y * 0.012 * a;
      if (b.pinned) { b.vx = 0; b.vy = 0; continue; }
      b.vx *= 0.82;
      b.vy *= 0.82;
      b.x += Math.max(-30, Math.min(30, b.vx));
      b.y += Math.max(-30, Math.min(30, b.vy));
    }
    alpha.current = Math.max(0, a * 0.985);
  }, [nodes, edges]);

  // O laço lê sempre o passo mais recente (os nós mudam quando o quadro atualiza)
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  const reheat = useCallback((to = 0.5) => {
    alpha.current = Math.max(alpha.current, to);
    if (raf.current != null) return;
    const tick = () => {
      stepRef.current();
      publish();
      raf.current = alpha.current > 0.01 ? requestAnimationFrame(tick) : null;
    };
    raf.current = requestAnimationFrame(tick);
  }, [publish]);

  // Novos nós nascem perto de quem eles se ligam; os antigos mantêm a posição
  useEffect(() => {
    const map = bodies.current;
    const ids = new Set(nodes.map((n) => n.id));
    for (const id of [...map.keys()]) if (!ids.has(id)) map.delete(id);
    let created = 0;
    for (const n of nodes) {
      if (map.has(n.id)) continue;
      const anchor = [...(neighbors.get(n.id) ?? [])].map((id) => map.get(id)).find(Boolean);
      const ang = Math.random() * Math.PI * 2;
      const rad = anchor ? 30 + Math.random() * 40 : 80 + Math.random() * 220;
      map.set(n.id, { x: (anchor?.x ?? 0) + Math.cos(ang) * rad, y: (anchor?.y ?? 0) + Math.sin(ang) * rad, vx: 0, vy: 0 });
      created++;
    }
    reheat(created > 0 ? 1 : 0.3);
  }, [nodes, neighbors, reheat]);

  useEffect(() => () => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }, []);

  // ---------------- Tamanho / enquadramento ----------------
  const fit = useCallback(() => {
    const list = [...bodies.current.values()];
    if (list.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of list) {
      minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x);
      minY = Math.min(minY, b.y); maxY = Math.max(maxY, b.y);
    }
    const pad = 80;
    const k = Math.max(0.25, Math.min(1.3, Math.min(size.w / (maxX - minX + pad * 2), size.h / (maxY - minY + pad * 2))));
    view.current = { k, x: size.w / 2 - ((minX + maxX) / 2) * k, y: size.h / 2 - ((minY + maxY) / 2) * k };
    publish();
  }, [size, publish]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => {
        // Mantém o centro do grafo no centro da tela ao redimensionar
        view.current.x += (width - prev.w) / 2;
        view.current.y += (height - prev.h) / 2;
        return { w: width, h: height };
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Enquadra sozinho quando a simulação inicial assenta
  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current || nodes.length === 0) return;
    const t = setTimeout(() => { fit(); didFit.current = true; }, 1600);
    return () => clearTimeout(t);
  }, [nodes.length, fit]);

  // ---------------- Interação ----------------
  const toWorld = (sx: number, sy: number) => {
    const v = view.current;
    return { x: (sx - v.x) / v.k, y: (sy - v.y) / v.k };
  };

  const zoomAt = useCallback((sx: number, sy: number, factor: number) => {
    const v = view.current;
    const k = Math.max(0.2, Math.min(4, v.k * factor));
    const wx = (sx - v.x) / v.k;
    const wy = (sy - v.y) / v.k;
    view.current = { k, x: sx - wx * k, y: sy - wy * k };
    publish();
  }, [publish]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const drag = useRef<{ mode: "node" | "pan"; id?: string; sx: number; sy: number; moved: boolean; vx: number; vy: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number } | null>(null);

  const local = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent, id?: string) => {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) };
      drag.current = null;
      return;
    }
    drag.current = { mode: id ? "node" : "pan", id, sx: p.x, sy: p.y, moved: false, vx: view.current.x, vy: view.current.y };
    if (id) {
      const b = bodies.current.get(id);
      if (b) b.pinned = true;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch.current.d);
      pinch.current.d = d;
      return;
    }
    const dg = drag.current;
    if (!dg) return;
    if (Math.hypot(p.x - dg.sx, p.y - dg.sy) > 4) dg.moved = true;
    if (dg.mode === "pan") {
      view.current = { ...view.current, x: dg.vx + (p.x - dg.sx), y: dg.vy + (p.y - dg.sy) };
      publish();
    } else if (dg.id && dg.moved) {
      const b = bodies.current.get(dg.id);
      if (b) {
        const w = toWorld(p.x, p.y);
        b.x = w.x; b.y = w.y; b.vx = 0; b.vy = 0;
        reheat(0.25);
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const dg = drag.current;
    drag.current = null;
    if (!dg) return;
    if (dg.id) {
      const b = bodies.current.get(dg.id);
      if (b) b.pinned = false;
    }
    if (dg.moved) return;
    // Clique (sem arrastar)
    if (!dg.id) { setFocusId(null); return; }
    const n = nodeById.get(dg.id);
    if (!n) return;
    if (n.kind === "card" && n.card) onCardClick?.(n.card.id);
    else setFocusId((cur) => (cur === n.id ? null : n.id));
  };

  // ---------------- Destaques ----------------
  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return null;
    return new Set(nodes.filter((n) => n.label.toLowerCase().includes(q)).map((n) => n.id));
  }, [nodes, q]);

  const activeId = hoverId ?? focusId;
  const lit = useMemo(() => {
    if (activeId) {
      const s = new Set(neighbors.get(activeId) ?? []);
      s.add(activeId);
      return s;
    }
    return matches;
  }, [activeId, neighbors, matches]);

  const stats = useMemo(() => {
    const cards = nodes.filter((n) => n.kind === "card" && n.card && !n.card.completed);
    return {
      open: cards.length,
      overdue: cards.filter((n) => n.overdue).length,
      soon: cards.filter((n) => n.soon).length,
      urgent: cards.filter((n) => n.card!.priority === "Urgente" || n.card!.priority === "Alta").length,
      loose: cards.filter((n) => (neighbors.get(n.id)?.size ?? 0) === 0).length,
    };
  }, [nodes, neighbors]);

  const v = snap.view;
  const pos = snap.pos;
  const showAllLabels = v.k >= 1.7;
  const hovered = hoverId ? nodeById.get(hoverId) : null;
  const hb = hoverId ? pos.get(hoverId) : null;

  const edgeColor = (e: GEdge) =>
    e.kind === "dep" ? "#f97316" : e.kind === "module" ? nodeById.get(e.t)?.color ?? "#334155" : e.kind === "project" ? nodeById.get(e.t)?.color ?? "#334155" : "#94a3b8";

  const toggle = (label: string, on: boolean, set: (v: boolean) => void) => (
    <button
      type="button"
      onClick={() => set(!on)}
      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
        on ? "bg-slate-800 text-white border-slate-600" : "text-slate-500 border-slate-800 hover:text-slate-300"
      }`}
      aria-pressed={on}
    >
      {label}
    </button>
  );

  return (
    <div ref={wrapRef} className="flex-1 relative overflow-hidden bg-[#06090f] select-none">
      {/* fundo pontilhado que acompanha o zoom/pan */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: "radial-gradient(circle, #1e293b 1px, transparent 1px)",
          backgroundSize: `${28 * v.k}px ${28 * v.k}px`,
          backgroundPosition: `${v.x}px ${v.y}px`,
        }}
      />

      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => onPointerDown(e)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label="Constelação das pendências"
      >
        <defs>
          <filter id="ng-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="ng-arrow" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#f97316" />
          </marker>
        </defs>

        <g transform={`translate(${v.x},${v.y}) scale(${v.k})`}>
          {/* Ligações */}
          {edges.map((e, i) => {
            const s = pos.get(e.s);
            const t = pos.get(e.t);
            if (!s || !t) return null;
            const on = lit ? lit.has(e.s) && lit.has(e.t) && (!activeId || e.s === activeId || e.t === activeId) : true;
            return (
              <line
                key={i}
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={edgeColor(e)}
                strokeWidth={(e.kind === "dep" ? 1.6 : 1) / Math.sqrt(v.k)}
                strokeDasharray={e.kind === "person" ? "3 4" : undefined}
                markerEnd={e.kind === "dep" ? "url(#ng-arrow)" : undefined}
                opacity={lit ? (on ? 0.85 : 0.04) : e.kind === "dep" ? 0.7 : 0.22}
              />
            );
          })}

          {/* Nós */}
          {nodes.map((n) => {
            const b = pos.get(n.id);
            if (!b) return null;
            const dim = lit ? !lit.has(n.id) : false;
            const isActive = n.id === activeId;
            const isHub = n.kind !== "card";
            const showLabel = !dim && (isActive || (lit != null && lit.has(n.id)) || isHub || showAllLabels || (n.important && v.k >= 0.7));
            const ring = n.overdue ? "#ef4444" : n.soon ? "#f59e0b" : null;
            return (
              <g
                key={n.id}
                transform={`translate(${b.x},${b.y})`}
                opacity={dim ? 0.12 : 1}
                className="cursor-pointer"
                onPointerDown={(e) => onPointerDown(e, n.id)}
                onPointerEnter={() => setHoverId(n.id)}
                onPointerLeave={() => setHoverId((h) => (h === n.id ? null : h))}
                onDoubleClick={() => { if (n.kind === "module" && n.refId) onOpenModule?.(n.refId); }}
              >
                {n.kind === "card" && (
                  <>
                    {ring && <circle r={n.r + 4} fill="none" stroke={ring} strokeWidth={1.5} opacity={0.9} filter="url(#ng-glow)" />}
                    <circle
                      r={n.r}
                      fill={n.color}
                      stroke={isActive ? "#fff" : "#06090f"}
                      strokeWidth={isActive ? 2 : 1.5}
                      filter={n.important || isActive ? "url(#ng-glow)" : undefined}
                    />
                    {(n.card?.priority === "Urgente") && <circle r={2.2} fill="#06090f" />}
                  </>
                )}
                {n.kind === "module" && (
                  <>
                    <circle r={n.r + 6} fill={n.color} opacity={0.12} />
                    <circle r={n.r} fill="#06090f" stroke={n.color} strokeWidth={2.5} />
                  </>
                )}
                {n.kind === "project" && (
                  <rect x={-n.r * 0.8} y={-n.r * 0.8} width={n.r * 1.6} height={n.r * 1.6} transform="rotate(45)" fill="#06090f" stroke={n.color} strokeWidth={2} />
                )}
                {n.kind === "person" && <circle r={n.r} fill="#06090f" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="2 2" />}

                {showLabel && (
                  <text
                    y={n.r + 13}
                    textAnchor="middle"
                    fontSize={isHub ? 11 : 10}
                    fontWeight={isHub ? 800 : 500}
                    fill={isHub ? n.color : n.overdue ? "#fecaca" : "#cbd5e1"}
                    stroke="#06090f"
                    strokeWidth={3}
                    paintOrder="stroke"
                    style={{ letterSpacing: n.kind === "module" ? "0.06em" : undefined, textTransform: n.kind === "module" ? "uppercase" : undefined }}
                    className="pointer-events-none font-sans"
                  >
                    {n.kind === "person" ? `@${short(n.label, 20)}` : short(n.label, isHub ? 22 : 30)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Ficha rápida da pendência sob o mouse */}
      {hovered?.kind === "card" && hovered.card && hb && (
        <div
          className="absolute z-20 pointer-events-none w-64 bg-[#0b101f]/95 backdrop-blur border border-slate-700 rounded-2xl p-3 shadow-2xl"
          style={{
            left: Math.min(size.w - 270, Math.max(6, hb.x * v.k + v.x + 16)),
            top: Math.min(size.h - 150, Math.max(6, hb.y * v.k + v.y + 16)),
          }}
        >
          <div className="text-sm font-bold text-white leading-snug">{hovered.card.title}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{hovered.card.columnTitle}</span>
            <span className={`px-1.5 py-0.5 rounded ${hovered.card.priority === "Urgente" ? "bg-red-500/20 text-red-300" : hovered.card.priority === "Alta" ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-400"}`}>
              {hovered.card.priority}
            </span>
            {hovered.card.dueDate && (
              <span className={`px-1.5 py-0.5 rounded ${hovered.overdue ? "bg-red-500/20 text-red-300" : hovered.soon ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-400"}`}>
                {hovered.overdue ? "atrasada · " : ""}{new Date(hovered.card.dueDate).toLocaleDateString("pt-BR")}
              </span>
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-400">
            {hovered.card.module?.title ?? "Sem módulo"}
            {hovered.card.project ? ` · ${hovered.card.project.title}` : ""}
            {hovered.card.assignee ? ` · com ${hovered.card.assignee}` : ""}
          </div>
          <div className="mt-1.5 text-[10px] text-slate-500 font-mono">clique para abrir</div>
        </div>
      )}

      {/* Barra de controles */}
      <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 bg-[#0b101f]/90 backdrop-blur border border-slate-800 rounded-xl px-2.5 py-1.5 w-full sm:w-64">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pendência, módulo, pessoa…"
            className="bg-transparent outline-none text-xs text-white placeholder:text-slate-500 w-full"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="text-slate-500 hover:text-white cursor-pointer" aria-label="Limpar busca">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 bg-[#0b101f]/90 backdrop-blur border border-slate-800 rounded-xl p-1.5">
          {toggle("Módulos", showModules, setShowModules)}
          {toggle("Projetos", showProjects, setShowProjects)}
          {toggle("Pessoas", showPeople, setShowPeople)}
          {toggle("Concluídas", showDone, setShowDone)}
        </div>
      </div>

      {/* Números */}
      <div className="absolute bottom-3 left-3 z-10 bg-[#0b101f]/90 backdrop-blur border border-slate-800 rounded-2xl p-3 text-[11px] font-mono space-y-1 hidden sm:block">
        <div className="text-white font-bold text-xs mb-1">{stats.open} pendências abertas</div>
        <div className="flex items-center gap-2 text-red-300"><span className="w-2.5 h-2.5 rounded-full border-2 border-red-500" /> {stats.overdue} atrasadas</div>
        <div className="flex items-center gap-2 text-amber-300"><span className="w-2.5 h-2.5 rounded-full border-2 border-amber-500" /> {stats.soon} vencem em até 2 dias</div>
        <div className="flex items-center gap-2 text-slate-300"><span className="w-3 h-3 rounded-full bg-slate-400" /> {stats.urgent} urgentes/altas (nós maiores)</div>
        <div className="flex items-center gap-2 text-orange-300"><span className="w-4 h-0.5 bg-orange-500" /> depende de</div>
        {stats.loose > 0 && <div className="text-slate-500">{stats.loose} soltas (sem módulo)</div>}
      </div>

      {/* Zoom */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5">
        {[
          { icon: <Plus size={15} />, label: "Aproximar", act: "in" },
          { icon: <Minus size={15} />, label: "Afastar", act: "out" },
          { icon: <Crosshair size={15} />, label: "Enquadrar tudo", act: "fit" },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={() => (b.act === "fit" ? fit() : zoomAt(size.w / 2, size.h / 2, b.act === "in" ? 1.25 : 0.8))}
            title={b.label}
            aria-label={b.label}
            className="w-9 h-9 grid place-items-center rounded-xl bg-[#0b101f]/90 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 cursor-pointer"
          >
            {b.icon}
          </button>
        ))}
      </div>

      {focusId && nodeById.get(focusId) && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 bg-[#0b101f]/95 border border-slate-700 rounded-xl px-3 py-1.5 text-[11px] font-mono text-slate-300 flex items-center gap-2">
          Foco: <b className="text-white">{nodeById.get(focusId)!.label}</b>
          {nodeById.get(focusId)!.kind === "module" && onOpenModule && (
            <button type="button" onClick={() => onOpenModule(nodeById.get(focusId)!.refId!)} className="text-blue-400 hover:text-blue-300 cursor-pointer">
              abrir no pipeline →
            </button>
          )}
          <button type="button" onClick={() => setFocusId(null)} className="text-slate-500 hover:text-white cursor-pointer" aria-label="Tirar foco">
            <X size={12} />
          </button>
        </div>
      )}

      {nodes.length === 0 && (
        <div className="absolute inset-0 grid place-items-center text-slate-500 text-sm font-mono">Nenhuma pendência para mostrar.</div>
      )}
    </div>
  );
}
