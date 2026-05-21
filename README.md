# Paggo Pipeline

Ferramenta de pipeline intelligence para gerentes de vendas B2B. Combina visualização de deals, regras de risco compostas, CRUD completo com máquina de estados, e um agente de IA conversacional com tool calling.

## Setup

**Pré-requisitos:** Node.js 18+, chave de API da Anthropic

```bash
git clone <repo>
cd paggo-pipeline
npm install

cp .env.local.example .env.local
# Preencha ANTHROPIC_API_KEY no .env.local

npm run dev
```

Acesse `http://localhost:3000`. Na primeira abertura, o app importa automaticamente o `public/deals.csv` para o banco local em `data/`.

Para produção:

```bash
npm run build && npm start
```

## Regras de Risco

O sistema calcula um score composto de 0–100 por deal. Quanto maior, mais urgente. Cada regra contribui com pontos; o total é limitado a 100.

**R1 — Close Date Vencida (+30–40 pts)**
A data esperada de fechamento já passou. A pontuação escala com o atraso (+3 pts/semana extra). Qualquer deal aqui está tecnicamente fora de previsão e precisa de ação imediata: um commit realista ou um fechamento limpo.

**R2 — SLA de Estágio Estourado (+15–25 pts)**
Cada estágio tem um SLA implícito: LEAD 14d, QUALIFIED 10d, DISCOVERY 14d, DEMO 7d, PROPOSAL 14d, NEGOTIATION 21d. Deals que ficam além do SLA geralmente estão estagnados, não evoluindo. A pontuação dobra se o tempo for maior que 2× o SLA.

**R3 — Inatividade / Ghost Deal (+15–35 pts)**
Sem nenhuma atividade registrada (ghost deal): +35 pts. Sem atividade há 30+ dias: +25 pts. Sem atividade há 14+ dias: +15 pts. Deals sem contato são os que morrem silenciosamente — reps que não registram atividade podem estar evitando uma conversa difícil.

**R4 — ENT Single-Threaded (+15 pts)**
Deals enterprise com apenas 1 contato registrado são de alto risco estrutural. Se esse contato sair, o deal trava. Em vendas B2B enterprise, multi-threading é requisito mínimo para viabilidade.

**R5 — Deal de Alto Valor Parado (+10 pts)**
Deals acima de R$50k sem atividade há 7+ dias. O tamanho do deal justifica um padrão de engajamento mais frequente.

**R6 — Fecha em Breve mas Está Frio (+20 pts)**
Deal com close date em 7 dias ou menos e sem atividade há 5+ dias. O timing cria urgência real: ou o rep retoma contato agora, ou o forecast do mês está comprometido.

**R7 — Novo Cliente Inativo (+8 pts)**
Segmento MID/ENT sem histórico de wins e sem atividade há 10+ dias. A ausência de relacionamento prévio eleva o risco de inatividade virar churn silencioso.

Classificação: 0–14 Baixo · 15–34 Médio · 35–59 Alto · 60+ Crítico

## Tools do Agente

| Tool | Tipo | Descrição |
|------|------|-----------|
| searchDeals | Leitura | Filtra deals por estágio, segmento, owner, valor, risco, inatividade |
| getPipelineStats | Leitura | KPIs agregados: funil, carga por owner, win rate, pipeline ponderado |
| getDealDetail | Leitura | Detalhes completos de um deal com atividades e audit log |
| updateStage | Escrita | Move deal para novo estágio (valida máquina de estados) |
| logActivity | Escrita | Registra CALL/EMAIL/MEETING/NOTE com notas e timestamp |
| scheduleNextStep | Escrita | Agenda próximo passo com data de vencimento |
| reassignOwner | Escrita | Reatribui o owner de um deal |
| closeDeal | Escrita | Fecha como CLOSED_WON ou CLOSED_LOST (motivo obrigatório) |
| draftOutreach | Geração | Redige email de follow-up personalizado com dados reais do deal |

Todas as tools de escrita mostram um preview e aguardam confirmação explícita antes de executar. Ações do agente são marcadas como agentOriginated no audit log.

## Máquina de Estados

LEAD → QUALIFIED → DISCOVERY → DEMO → PROPOSAL → NEGOTIATION → CLOSED_WON

Qualquer estágio pode ir para CLOSED_LOST. Transições inválidas são rejeitadas. CLOSED_LOST exige lostReason estruturado (NO_BUDGET, LOST_TO_COMPETITOR, NO_DECISION, OTHER).

## Decisões de Design

**Banco:** JSON files em data/ ao invés de um banco externo. Elimina dependências nativas e setup de infra, sem comprometer a demonstração. Em produção, lib/db.ts trocaria para Supabase/Neon com mudança mínima.

**UI:** Tabela como padrão (mais denso que kanban para 200+ deals) com filtros rápidos por estágio na barra de resumo. O agente fica fixo à direita — tela dividida intencional para o gerente usar o agente enquanto navega nos deals.

**Risk scoring:** Score composto ao invés de flags binárias. Um deal pode ter várias razões para ser preocupante; o score reflete a gravidade total e permite ordenação real por prioridade.

**Audit log:** Toda operação gera um entry com timestamp, ator e detalhe. Ações do agente têm agentOriginated: true e marcação visual diferenciada.

**Outreach:** draftOutreach faz uma chamada separada ao Claude com contexto real do deal. O rascunho é retornado no chat para revisão antes de qualquer ação.
"# PIPELINE" 
