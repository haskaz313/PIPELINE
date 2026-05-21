import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  getDeals,
  getPipelineStats,
  updateStage,
  logActivity,
  scheduleNextStep,
  reassignOwner,
  closeDeal,
  getDeal,
  getOwners,
} from "@/lib/db";
import { VALID_TRANSITIONS } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const tools: Anthropic.Tool[] = [
  {
    name: "searchDeals",
    description:
      "Busca e filtra deals no pipeline. Use para responder perguntas sobre o pipeline, encontrar deals por critério, listar deals em risco, etc.",
    input_schema: {
      type: "object",
      properties: {
        stages: { type: "array", items: { type: "string" }, description: "Filtrar por estágios" },
        segments: { type: "array", items: { type: "string" }, description: "SMB, MID, ENT" },
        owners: { type: "array", items: { type: "string" }, description: "Filtrar por owner" },
        minAmount: { type: "number" },
        maxAmount: { type: "number" },
        riskMin: { type: "number", description: "Score de risco mínimo (0-100)" },
        overdueOnly: { type: "boolean" },
        industries: { type: "array", items: { type: "string" } },
        noActivityDays: { type: "number", description: "Sem atividade há pelo menos N dias" },
        limit: { type: "number", description: "Máximo de resultados (padrão 20)" },
        sortBy: { type: "string", description: "riskScore, amount, daysInCurrentStage, expectedCloseDate" },
      },
    },
  },
  {
    name: "getPipelineStats",
    description: "Retorna estatísticas agregadas do pipeline: funil por estágio, carga por owner, win rate, pipeline ponderado, etc.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "getDealDetail",
    description: "Retorna detalhes completos de um deal específico, incluindo histórico de atividades e audit log.",
    input_schema: {
      type: "object",
      properties: {
        dealId: { type: "string", description: "ID exato do deal (ex: DEAL-404024)" },
      },
      required: ["dealId"],
    },
  },
  {
    name: "updateStage",
    description: "Move um deal para um novo estágio. Respeita a máquina de estados. REQUER confirmação do usuário antes de executar.",
    input_schema: {
      type: "object",
      properties: {
        dealId: { type: "string" },
        newStage: { type: "string", description: "LEAD|QUALIFIED|DISCOVERY|DEMO|PROPOSAL|NEGOTIATION|CLOSED_WON|CLOSED_LOST" },
      },
      required: ["dealId", "newStage"],
    },
  },
  {
    name: "logActivity",
    description: "Registra uma atividade (CALL, EMAIL, MEETING, NOTE) num deal. REQUER confirmação para batch de múltiplos deals.",
    input_schema: {
      type: "object",
      properties: {
        dealId: { type: "string" },
        type: { type: "string", description: "CALL|EMAIL|MEETING|NOTE" },
        notes: { type: "string", description: "Conteúdo ou resumo da atividade" },
        isPlanned: { type: "boolean", description: "Se é uma atividade planejada (não executada ainda)" },
        scheduledAt: { type: "string", description: "ISO timestamp se for planejada" },
      },
      required: ["dealId", "type", "notes"],
    },
  },
  {
    name: "scheduleNextStep",
    description: "Agenda um próximo passo para um deal. REQUER confirmação para batch.",
    input_schema: {
      type: "object",
      properties: {
        dealId: { type: "string" },
        type: { type: "string", description: "CALL|EMAIL|MEETING|NOTE" },
        notes: { type: "string" },
        dueAt: { type: "string", description: "ISO timestamp de vencimento" },
      },
      required: ["dealId", "type", "notes", "dueAt"],
    },
  },
  {
    name: "reassignOwner",
    description: "Reatribui o owner de um deal. REQUER confirmação.",
    input_schema: {
      type: "object",
      properties: {
        dealId: { type: "string" },
        newOwner: { type: "string" },
      },
      required: ["dealId", "newOwner"],
    },
  },
  {
    name: "closeDeal",
    description: "Fecha um deal como CLOSED_WON ou CLOSED_LOST. REQUER confirmação explícita. CLOSED_LOST exige lostReason.",
    input_schema: {
      type: "object",
      properties: {
        dealId: { type: "string" },
        outcome: { type: "string", description: "CLOSED_WON|CLOSED_LOST" },
        lostReason: { type: "string", description: "NO_BUDGET|LOST_TO_COMPETITOR|NO_DECISION|OTHER (obrigatório se CLOSED_LOST)" },
      },
      required: ["dealId", "outcome"],
    },
  },
  {
    name: "draftOutreach",
    description: "Redige um email de follow-up personalizado para um deal, usando dados reais do deal (estágio, valor, segmento, última atividade, histórico da conta). Retorna o rascunho sem enviar.",
    input_schema: {
      type: "object",
      properties: {
        dealId: { type: "string" },
        tone: { type: "string", description: "formal|casual|urgente (padrão: formal)" },
      },
      required: ["dealId"],
    },
  },
];

async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  confirmed: boolean
): Promise<{ result: unknown; requiresConfirmation?: boolean; preview?: unknown }> {
  const writeTools = ["updateStage", "logActivity", "scheduleNextStep", "reassignOwner", "closeDeal"];
  const isWrite = writeTools.includes(toolName);

  if (isWrite && !confirmed) {
    return { result: null, requiresConfirmation: true, preview: { tool: toolName, input } };
  }

  switch (toolName) {
    case "searchDeals": {
      const {
        stages, segments, owners, minAmount, maxAmount, riskMin,
        overdueOnly, industries, noActivityDays, limit = 20, sortBy = "riskScore",
      } = input as Record<string, unknown>;

      let deals = getDeals().filter(
        (d) => d.stage !== "CLOSED_WON" && d.stage !== "CLOSED_LOST"
      );

      if (stages && Array.isArray(stages)) deals = deals.filter((d) => (stages as string[]).includes(d.stage));
      if (segments && Array.isArray(segments)) deals = deals.filter((d) => (segments as string[]).includes(d.accountSegment));
      if (owners && Array.isArray(owners)) deals = deals.filter((d) => (owners as string[]).includes(d.ownerName));
      if (typeof minAmount === "number") deals = deals.filter((d) => d.amount >= minAmount);
      if (typeof maxAmount === "number") deals = deals.filter((d) => d.amount <= maxAmount);
      if (typeof riskMin === "number") deals = deals.filter((d) => (d.riskScore ?? 0) >= riskMin);
      if (overdueOnly) {
        const today = new Date();
        deals = deals.filter((d) => new Date(d.expectedCloseDate) < today);
      }
      if (industries && Array.isArray(industries)) deals = deals.filter((d) => (industries as string[]).includes(d.industry));
      if (typeof noActivityDays === "number") {
        const cutoff = new Date(Date.now() - noActivityDays * 86400000);
        deals = deals.filter((d) => !d.lastActivityAt || new Date(d.lastActivityAt) < cutoff);
      }

      deals.sort((a, b) => {
        if (sortBy === "amount") return b.amount - a.amount;
        if (sortBy === "daysInCurrentStage") return b.daysInCurrentStage - a.daysInCurrentStage;
        if (sortBy === "expectedCloseDate") return a.expectedCloseDate.localeCompare(b.expectedCloseDate);
        return (b.riskScore ?? 0) - (a.riskScore ?? 0);
      });

      const result = deals.slice(0, limit as number).map((d) => ({
        dealId: d.dealId,
        accountName: d.accountName,
        accountSegment: d.accountSegment,
        stage: d.stage,
        amount: d.amount,
        ownerName: d.ownerName,
        riskScore: d.riskScore,
        riskFlags: d.riskFlags?.map((f) => f.label),
        daysInCurrentStage: d.daysInCurrentStage,
        lastActivityAt: d.lastActivityAt,
        expectedCloseDate: d.expectedCloseDate,
        contactsLogged: d.contactsLogged,
        industry: d.industry,
      }));

      return { result: { total: deals.length, shown: result.length, deals: result } };
    }

    case "getPipelineStats": {
      return { result: getPipelineStats() };
    }

    case "getDealDetail": {
      const { dealId } = input as { dealId: string };
      const deal = getDeal(dealId);
      if (!deal) return { result: { error: `Deal ${dealId} não encontrado` } };
      return { result: deal };
    }

    case "updateStage": {
      const { dealId, newStage } = input as { dealId: string; newStage: string };
      if (!dealId || !newStage) return { result: { error: "dealId e newStage obrigatórios" } };
      const res = updateStage(dealId, newStage as never, "agent", true);
      return { result: res };
    }

    case "logActivity": {
      const { dealId, type, notes, isPlanned, scheduledAt } = input as Record<string, string | boolean | undefined>;
      if (!dealId || !type) return { result: { error: "dealId e type obrigatórios" } };
      const res = logActivity(
        dealId as string, type as never, (notes as string) ?? "", "agent", true,
        Boolean(isPlanned), scheduledAt as string | undefined
      );
      return { result: res };
    }

    case "scheduleNextStep": {
      const { dealId, type, notes, dueAt } = input as Record<string, string>;
      if (!dealId || !type || !dueAt) return { result: { error: "dealId, type e dueAt obrigatórios" } };
      const res = scheduleNextStep(dealId, type as never, notes ?? "", dueAt, "agent", true);
      return { result: res };
    }

    case "reassignOwner": {
      const { dealId, newOwner } = input as { dealId: string; newOwner: string };
      if (!dealId || !newOwner) return { result: { error: "dealId e newOwner obrigatórios" } };
      const res = reassignOwner(dealId, newOwner, "agent", true);
      return { result: res };
    }

    case "closeDeal": {
      const { dealId, outcome, lostReason } = input as Record<string, string>;
      if (!dealId || !outcome) return { result: { error: "dealId e outcome obrigatórios" } };
      const res = closeDeal(dealId, outcome as never, lostReason ?? null, "agent", true);
      return { result: res };
    }

    case "draftOutreach": {
      const { dealId, tone = "formal" } = input as { dealId: string; tone?: string };
      const deal = getDeal(dealId);
      if (!deal) return { result: { error: `Deal ${dealId} não encontrado` } };

      const today = new Date();
      const daysSinceActivity = deal.lastActivityAt
        ? Math.floor((today.getTime() - new Date(deal.lastActivityAt).getTime()) / 86400000)
        : null;
      const daysToClose = Math.floor((new Date(deal.expectedCloseDate).getTime() - today.getTime()) / 86400000);

      const validTransitions = VALID_TRANSITIONS[deal.stage];

      const draftPrompt = `Você é um consultor de vendas B2B sênior. Redija um email de follow-up para o seguinte deal:

Deal: ${deal.dealId}
Conta: ${deal.accountName} (${deal.accountSegment}, ${deal.industry})
Valor: R$${deal.amount.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
Estágio atual: ${deal.stage}
Owner: ${deal.ownerName}
Última atividade: ${deal.lastActivityAt ? `${daysSinceActivity} dias atrás (${deal.lastActivityType})` : "nenhuma atividade registrada"}
Data prevista de fechamento: ${deal.expectedCloseDate} (${daysToClose > 0 ? `em ${daysToClose} dias` : `${Math.abs(daysToClose)} dias atrasado`})
Histórico de deals ganhos com essa conta: ${deal.previousDealsWithAccount}
Produto de interesse: ${deal.productInterest}
Tom solicitado: ${tone}

Próximos estágios possíveis: ${validTransitions.join(", ")}

Escreva um email curto e eficaz (150-200 palavras). Inclua:
- Linha de assunto
- Corpo do email adaptado ao estágio e contexto real
- Próximo passo claro

Não use placeholders genéricos como [NOME]. Use o contexto real do deal. Responda apenas com o email.`;

      const draftResp = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        messages: [{ role: "user", content: draftPrompt }],
      });

      const draftText = draftResp.content.find((b) => b.type === "text")?.text ?? "";
      return {
        result: {
          dealId,
          accountName: deal.accountName,
          stage: deal.stage,
          draft: draftText,
        },
      };
    }

    default:
      return { result: { error: `Tool desconhecida: ${toolName}` } };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messages, confirmed = false } = body as {
    messages: Anthropic.MessageParam[];
    confirmed?: boolean;
  };

  if (!messages?.length) {
    return NextResponse.json({ error: "messages obrigatório" }, { status: 400 });
  }

  const owners = getOwners();
  const today = new Date().toISOString().split("T")[0];

  const systemPrompt = `Você é um agente de pipeline intelligence para uma equipe de vendas B2B SaaS. Hoje é ${today}.

Owners ativos: ${owners.join(", ")}

Suas responsabilidades:
1. Responder perguntas sobre o pipeline em linguagem natural
2. Executar ações no pipeline (mudar estágio, registrar atividade, agendar próximos passos, reatribuir owners, fechar deals)
3. Redigir emails de follow-up personalizados usando dados reais dos deals

Regras críticas:
- NUNCA invente dealIds, nomes de conta, valores ou nomes de contato. Use apenas dados retornados pelas ferramentas.
- Para ações que afetam múltiplos deals, mostre um preview completo ANTES de executar e indique que precisa de confirmação.
- Para closeDeal, closeDeal em batch ou reassignOwner: sempre mostre preview e peça confirmação.
- Se não tiver os dados necessários, pergunte ao usuário ou recuse.
- Ações originadas por você são marcadas como agentOriginated=true no audit log.
- Seja preciso e direto. Não invente informações.
- Ao redigir outreach, use exclusivamente dados reais do deal — nunca templates genéricos.

Quando o usuário confirmar ações pendentes, execute-as. Quando disser "confirma" ou "execute", proceda com as ações planejadas.`;

  try {
    const pendingConfirmations: Array<{ tool: string; input: Record<string, unknown> }> = [];
    const responseMessages: Anthropic.MessageParam[] = [...messages];
    const agentActions: Array<{ tool: string; input: unknown; result: unknown }> = [];

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages: responseMessages,
    });

    let currentResponse = response;
    let iterations = 0;

    while (currentResponse.stop_reason === "tool_use" && iterations < 10) {
      iterations++;
      const toolUseBlocks = currentResponse.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      responseMessages.push({ role: "assistant", content: currentResponse.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolBlock of toolUseBlocks) {
        const input = toolBlock.input as Record<string, unknown>;
        const { result, requiresConfirmation, preview } = await executeTool(
          toolBlock.name,
          input,
          confirmed
        );

        if (requiresConfirmation) {
          pendingConfirmations.push(preview as { tool: string; input: Record<string, unknown> });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: JSON.stringify({ status: "PENDING_CONFIRMATION", action: preview }),
          });
        } else {
          agentActions.push({ tool: toolBlock.name, input, result });
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolBlock.id,
            content: JSON.stringify(result),
          });
        }
      }

      responseMessages.push({ role: "user", content: toolResults });

      currentResponse = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        tools,
        messages: responseMessages,
      });
    }

    const textContent = currentResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return NextResponse.json({
      reply: textContent,
      pendingConfirmations,
      agentActions,
      requiresConfirmation: pendingConfirmations.length > 0,
    });
  } catch (err) {
    console.error("Agent error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
