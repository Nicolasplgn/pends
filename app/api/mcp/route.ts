// Servidor MCP do Pends (Streamable HTTP) para conectar ao Claude como conector personalizado.
// Toda chamada exige token OAuth válido (lib/oauth.ts). Nenhuma ferramenta apaga dados.
import { createMcpHandler, getPublicOrigin, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { corsHeaders, verifyAccessToken } from "@/lib/oauth";
import {
  cardDetail, completeCard, createCardFromTool, createTransactionFromTool, daySummary, financeSummary, listCards, listCreditCards,
  listModules, updateCardFromTool,
} from "@/lib/pends/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_CHARS = 20_000;

/** Resposta em JSON, cortada se ficar grande demais. */
function ok(data: unknown) {
  let text = JSON.stringify(data, null, 1);
  if (text.length > MAX_CHARS) text = `${text.slice(0, MAX_CHARS)}\n… (resposta cortada; use filtros ou um limite menor)`;
  return { content: [{ type: "text" as const, text }] };
}

/** Erro amigável, sem detalhes internos (stack, SQL, ids). */
function fail(e: unknown) {
  const msg = e instanceof Error && e.message.length < 300 && !/prisma|invocation|\n/i.test(e.message)
    ? e.message
    : "Não foi possível concluir a operação.";
  if (!(e instanceof Error) || msg !== e.message) console.error("MCP tool error:", e);
  return { content: [{ type: "text" as const, text: msg }], isError: true };
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");
const priority = z.enum(["Baixa", "Normal", "Alta", "Urgente"]);
const ref = z.string().trim().min(6).max(36).describe("id da pendência (os 8 caracteres que aparecem em listar_pendencias)");

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "listar_pendencias",
      {
        title: "Listar pendências",
        description:
          "Lista as pendências (cards do quadro) do Pends com filtros. Por padrão traz só as abertas, ordenadas por prazo.",
        inputSchema: z.object({
          status: z.enum(["abertas", "concluidas", "todas"]).default("abertas").describe("abertas (padrão), concluidas ou todas"),
          modulo: z.string().trim().max(60).optional().describe("nome (ou parte) do módulo de vida, ex.: Trabalho"),
          prazo_de: date.optional().describe("prazo a partir de (AAAA-MM-DD)"),
          prazo_ate: date.optional().describe("prazo até (AAAA-MM-DD)"),
          texto: z.string().trim().max(100).optional().describe("busca no título e na descrição"),
          limite: z.number().int().min(1).max(50).default(20).describe("máximo de itens (1 a 50)"),
        }),
        annotations: { readOnlyHint: true },
      },
      async (a) => {
        try {
          return ok(await listCards({ status: a.status, modulo: a.modulo, prazoDe: a.prazo_de, prazoAte: a.prazo_ate, texto: a.texto, limite: a.limite }));
        } catch (e) {
          return fail(e);
        }
      }
    );

    server.registerTool(
      "criar_pendencia",
      {
        title: "Criar pendência",
        description: "Cria uma pendência na etapa \"A fazer\" do quadro.",
        inputSchema: z.object({
          titulo: z.string().trim().min(1).max(200),
          descricao: z.string().trim().max(8000).optional(),
          modulo: z.string().trim().max(60).optional().describe("nome exato do módulo (veja listar_modulos)"),
          prioridade: priority.default("Normal"),
          prazo: date.optional().describe("AAAA-MM-DD"),
          projeto: z.string().trim().max(60).optional().describe("nome do projeto, se houver"),
        }),
      },
      async (a) => {
        try {
          return ok({ criada: await createCardFromTool(a) });
        } catch (e) {
          return fail(e);
        }
      }
    );

    server.registerTool(
      "atualizar_pendencia",
      {
        title: "Atualizar pendência",
        description:
          "Altera uma pendência; só os campos enviados mudam. Para registrar um andamento/anotação use `nota`: ela é acrescentada no fim da descrição sem apagar nada. `descricao` SUBSTITUI o texto inteiro: só use se o usuário pedir para reescrever, e antes leia a descrição completa com ver_pendencia.",
        inputSchema: z.object({
          id: ref,
          titulo: z.string().trim().min(1).max(200).optional(),
          nota: z.string().trim().min(1).max(2000).optional().describe("linha a acrescentar no fim da descrição, ex.: \"22/11: aguardando a ESWEB subir o site\""),
          descricao: z.string().trim().max(8000).optional().describe("texto novo e completo da descrição (substitui o atual)"),
          modulo: z.string().trim().max(60).optional(),
          prioridade: priority.optional(),
          prazo: date.nullable().optional().describe("AAAA-MM-DD, ou null para tirar o prazo"),
        }),
      },
      async ({ id, ...rest }) => {
        try {
          return ok({ atualizada: await updateCardFromTool(id, rest) });
        } catch (e) {
          return fail(e);
        }
      }
    );

    server.registerTool(
      "ver_pendencia",
      {
        title: "Ver pendência",
        description:
          "Ficha completa de uma pendência: descrição inteira, checklist, de quem ela depende e o histórico recente. Use antes de editar a descrição.",
        inputSchema: z.object({ id: ref }),
        annotations: { readOnlyHint: true },
      },
      async ({ id }) => {
        try {
          return ok(await cardDetail(id));
        } catch (e) {
          return fail(e);
        }
      }
    );

    server.registerTool(
      "concluir_pendencia",
      {
        title: "Concluir pendência",
        description: "Marca a pendência como concluída (move para a etapa final). Se já estiver concluída, não faz nada.",
        inputSchema: z.object({ id: ref }),
        annotations: { idempotentHint: true },
      },
      async ({ id }) => {
        try {
          return ok(await completeCard(id));
        } catch (e) {
          return fail(e);
        }
      }
    );

    server.registerTool(
      "listar_modulos",
      {
        title: "Listar módulos de vida",
        description: "Lista os módulos de vida (ex.: Trabalho, Faculdade) com a quantidade de pendências abertas e o teto mensal de gasto.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => {
        try {
          return ok(await listModules());
        } catch (e) {
          return fail(e);
        }
      }
    );

    server.registerTool(
      "registrar_transacao",
      {
        title: "Registrar lançamento financeiro",
        description:
          "Registra uma entrada ou saída no financeiro do Pends. Data de hoje ou passada entra como paga/recebida; data futura entra a pagar/receber. No cartão, entra a pagar na fatura do cartão escolhido em `cartao`.",
        inputSchema: z.object({
          valor: z.number().positive().max(10_000_000).describe("valor em reais, ex.: 59.9"),
          tipo: z.enum(["entrada", "saida"]),
          categoria: z.string().trim().min(1).max(60).describe("use o nome de um módulo de vida (veja listar_modulos)"),
          data: date.describe("vencimento ou data do gasto (AAAA-MM-DD); no cartão, a data da compra"),
          descricao: z.string().trim().min(1).max(200),
          forma: z.enum(["pix", "boleto", "debito", "cartao"]).default("pix"),
          ja_pago: z.boolean().optional().describe("força pago/recebido (true) ou em aberto (false)"),
          cartao: z.string().trim().max(40).optional().describe("nome do cartão quando forma = cartao (veja listar_cartoes); obrigatório se houver mais de um"),
        }),
      },
      async (a) => {
        try {
          return ok(await createTransactionFromTool(a));
        } catch (e) {
          return fail(e);
        }
      }
    );

    server.registerTool(
      "listar_cartoes",
      {
        title: "Listar cartões de crédito",
        description: "Lista os cartões de crédito com dia de fechamento, vencimento, limite, valor em aberto e limite disponível.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => {
        try {
          return ok(await listCreditCards());
        } catch (e) {
          return fail(e);
        }
      }
    );

    server.registerTool(
      "resumo_financeiro",
      {
        title: "Resumo financeiro",
        description: "Entradas, saídas, saldo e total de saídas por categoria num período (padrão: mês atual; máximo 13 meses).",
        inputSchema: z.object({
          de: date.optional().describe("início (AAAA-MM-DD)"),
          ate: date.optional().describe("fim (AAAA-MM-DD)"),
        }),
        annotations: { readOnlyHint: true },
      },
      async ({ de, ate }) => {
        try {
          return ok(await financeSummary(de, ate));
        } catch (e) {
          return fail(e);
        }
      }
    );

    server.registerTool(
      "resumo_do_dia",
      {
        title: "Resumo do dia",
        description: "Pendências e contas atrasadas, de hoje e dos próximos 7 dias, entradas previstas e o resumo do mês.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      },
      async () => {
        try {
          return ok(await daySummary());
        } catch (e) {
          return fail(e);
        }
      }
    );
  },
  { serverInfo: { name: "pends", version: "1.0.0" } }
);

const authed = withMcpAuth(
  handler,
  (req, token) => {
    const info = verifyAccessToken(token, `${getPublicOrigin(req)}/api/mcp`);
    return info ? { token: token!, clientId: info.clientId, scopes: info.scopes, expiresAt: info.expiresAt } : undefined;
  },
  { required: true, resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp" }
);

async function withCors(req: Request) {
  const res = await authed(req);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export { withCors as GET, withCors as POST, withCors as DELETE };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
