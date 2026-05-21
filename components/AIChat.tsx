"use client";
import { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, CheckCircle, AlertCircle, X } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  pendingConfirmations?: Array<{ tool: string; input: unknown }>;
  agentActions?: Array<{ tool: string; input: unknown; result: unknown }>;
}

interface Props {
  onRefresh: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function AIChat({ onRefresh, isOpen, onToggle }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá. Posso responder perguntas sobre o pipeline, executar ações e redigir outreach. Experimente: *\"Quais 10 deals estão mais em risco agora?\"* ou *\"Resuma a saúde do funil ENT\"*.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<Array<{ tool: string; input: unknown }> | null>(null);
  const [pendingHistory, setPendingHistory] = useState<Array<{ role: string; content: string }>>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(userMessage: string, confirmed = false, confirmedHistory?: typeof pendingHistory) {
    const history = confirmedHistory ?? pendingHistory;
    const apiMessages = [
      ...messages
        .filter((m) => !m.pendingConfirmations?.length)
        .map((m) => ({ role: m.role, content: m.content })),
      ...(history.length > 0 ? history : [{ role: "user" as const, content: userMessage }]),
    ];

    if (!confirmedHistory) {
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    }
    setLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, confirmed }),
      });
      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Erro: ${data.error}` },
        ]);
        return;
      }

      const assistantMsg: Message = {
        role: "assistant",
        content: data.reply,
        agentActions: data.agentActions,
      };

      if (data.requiresConfirmation && data.pendingConfirmations?.length > 0) {
        setPendingActions(data.pendingConfirmations);
        const updatedHistory = [
          ...apiMessages,
          { role: "assistant" as const, content: data.reply },
        ];
        setPendingHistory(updatedHistory);
        assistantMsg.pendingConfirmations = data.pendingConfirmations;
      } else {
        setPendingActions(null);
        setPendingHistory([]);
        if (data.agentActions?.length > 0) {
          onRefresh();
        }
      }

      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!pendingActions) return;
    const confirmMsg = "Confirmo. Execute as ações.";
    setMessages((prev) => [...prev, { role: "user", content: confirmMsg }]);
    const history = [
      ...pendingHistory,
      { role: "user" as const, content: confirmMsg },
    ];
    setPendingActions(null);
    setPendingHistory([]);
    await send(confirmMsg, true, history);
    onRefresh();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleSend() {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    send(msg);
  }

  const suggestions = [
    "Top 10 deals em risco",
    "Resuma o funil ENT",
    "Quem está sobrecarregado?",
    "Deals PROPOSAL sem atividade há 7+ dias",
  ];

  return (
    <div
      className="card flex flex-col"
      aria-hidden={!isOpen}
      style={{
        height: "100%",
        background: "var(--surface)",
        borderLeft: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded flex items-center justify-center"
            style={{ background: "rgba(99,102,241,0.2)" }}
          >
            <Bot size={13} style={{ color: "var(--accent)" }} />
          </div>
          <span className="text-sm font-semibold">Agente</span>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: "var(--green)" }}
          />
        </div>
        <button onClick={onToggle} className="hover:opacity-70" style={{ color: "var(--text-muted)" }}>
          <X size={15} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className="max-w-[90%] rounded-xl text-sm"
              style={{
                padding: "10px 14px",
                background: m.role === "user" ? "rgba(99,102,241,0.2)" : "var(--surface-2)",
                color: "var(--text)",
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
              }}
            >
              {m.content}
            </div>

            {m.pendingConfirmations && m.pendingConfirmations.length > 0 && (
              <div
                className="max-w-[90%] rounded-xl p-3 text-xs flex flex-col gap-2"
                style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}
              >
                <div className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--amber)" }}>
                  <AlertCircle size={12} />
                  Aguardando confirmação
                </div>
                {m.pendingConfirmations.map((a, j) => (
                  <div key={j} className="font-mono" style={{ color: "var(--text-muted)" }}>
                    {a.tool}: {JSON.stringify(a.input).slice(0, 80)}
                    {JSON.stringify(a.input).length > 80 ? "..." : ""}
                  </div>
                ))}
                {i === messages.length - 1 && (
                  <button
                    onClick={confirm}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded font-medium disabled:opacity-40"
                    style={{ background: "rgba(245,158,11,0.2)", color: "var(--amber)" }}
                  >
                    <CheckCircle size={12} />
                    Confirmar e Executar
                  </button>
                )}
              </div>
            )}

            {m.agentActions && m.agentActions.length > 0 && (
              <div
                className="max-w-[90%] rounded-xl px-3 py-2 text-xs"
                style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}
              >
                <div className="flex items-center gap-1" style={{ color: "var(--green)" }}>
                  <CheckCircle size={11} />
                  <span>{m.agentActions.length} ação(ões) executada(s)</span>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
            <Loader2 size={12} className="animate-spin" />
            Processando...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => { setInput(s); textareaRef.current?.focus(); }}
              className="text-xs px-2.5 py-1 rounded-full transition-opacity hover:opacity-80"
              style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div
        className="p-3 flex gap-2 items-end"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte sobre o pipeline ou peça uma ação..."
          rows={2}
          className="flex-1 resize-none rounded-lg px-3 py-2 text-sm"
          style={{
            background: "var(--surface-2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            outline: "none",
          }}
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="p-2 rounded-lg transition-opacity disabled:opacity-30"
          style={{ background: "var(--accent)" }}
        >
          <Send size={15} style={{ color: "#fff" }} />
        </button>
      </div>
    </div>
  );
}
