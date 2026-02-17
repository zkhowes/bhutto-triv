"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import NavBar from "@/components/layout/NavBar";

interface ParsedQuestion {
  category: string;
  questionText: string;
  answerFormat: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: string;
  correctAnswer?: string;
}

export default function WorkshopPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string; parsed?: ParsedQuestion }>
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState<number | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const newMessages = [
      ...messages,
      { role: "user" as const, content: input },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/questions/workshop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      const assistantMessage = data.response || "No response";

      // Try to parse the response into structured question data
      let parsed: ParsedQuestion | undefined;
      try {
        const parseRes = await fetch("/api/questions/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: assistantMessage }),
        });
        if (parseRes.ok) {
          parsed = await parseRes.json();
        }
      } catch {
        // Parsing failed, just show text
      }

      setMessages([
        ...newMessages,
        { role: "assistant", content: assistantMessage, parsed },
      ]);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "Something went wrong. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const saveDraft = async (text: string, msgIndex: number) => {
    setSavingDraft(msgIndex);
    try {
      // First try to parse into structured fields
      const parseRes = await fetch("/api/questions/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      let draftBody: Record<string, unknown> = { questionText: text };

      if (parseRes.ok) {
        const parsed = await parseRes.json();
        draftBody = {
          category: parsed.category,
          questionText: parsed.questionText,
          answerFormat: parsed.answerFormat,
          optionA: parsed.optionA || null,
          optionB: parsed.optionB || null,
          optionC: parsed.optionC || null,
          optionD: parsed.optionD || null,
          correctOption: parsed.correctOption || null,
          correctAnswer: parsed.correctAnswer || null,
        };
      }

      await fetch("/api/questions/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftBody),
      });
      alert(parseRes.ok ? "Saved to drafts (parsed)!" : "Saved to drafts (raw)!");
    } catch {
      alert("Failed to save draft");
    } finally {
      setSavingDraft(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 py-6">
        <h1 className="text-xl font-bold text-white mb-1">
          Question Workshop
        </h1>
        <p className="text-sm text-[#a0a0b8] mb-4">
          Chat with AI to brainstorm and refine trivia questions
        </p>

        {/* Chat area */}
        <div className="flex-1 card p-4 mb-4 overflow-y-auto max-h-[60vh]">
          {messages.length === 0 && (
            <div className="text-center py-10 text-[#666680]">
              <p className="text-lg mb-2">&#128161;</p>
              <p className="text-sm">
                Ask me to help create trivia questions! I can suggest formats,
                generate options, and validate difficulty.
              </p>
              <div className="mt-4 space-y-2">
                <button
                  onClick={() =>
                    setInput(
                      "Help me create a geography question about world capitals"
                    )
                  }
                  className="block mx-auto text-xs bg-[#1e3a5f] text-[#a0a0b8] px-3 py-1.5 rounded-full hover:text-white"
                >
                  &quot;Help me create a geography question&quot;
                </button>
                <button
                  onClick={() =>
                    setInput(
                      "I want to ask about the history of the Olympics, suggest a question"
                    )
                  }
                  className="block mx-auto text-xs bg-[#1e3a5f] text-[#a0a0b8] px-3 py-1.5 rounded-full hover:text-white"
                >
                  &quot;Suggest an Olympics history question&quot;
                </button>
                <button
                  onClick={() =>
                    setInput(
                      "Make a tricky science question with multiple choice options"
                    )
                  }
                  className="block mx-auto text-xs bg-[#1e3a5f] text-[#a0a0b8] px-3 py-1.5 rounded-full hover:text-white"
                >
                  &quot;Make a tricky science question&quot;
                </button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "user" ? (
                  <div className="max-w-[80%] p-3 rounded-xl text-sm bg-[#e94560]/20 text-white">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ) : msg.parsed ? (
                  <div className="max-w-[90%] p-4 rounded-xl bg-[#1e3a5f] border border-[#254a73]">
                    <div className="mb-3">
                      <span className="text-xs font-semibold text-[#fbbf24] uppercase tracking-wider">
                        {msg.parsed.category}
                      </span>
                    </div>
                    <p className="text-white font-medium mb-3">{msg.parsed.questionText}</p>
                    {msg.parsed.answerFormat === "multiple_choice" && (
                      <div className="space-y-2 mb-3">
                        {[
                          { label: "A", text: msg.parsed.optionA },
                          { label: "B", text: msg.parsed.optionB },
                          { label: "C", text: msg.parsed.optionC },
                          { label: "D", text: msg.parsed.optionD },
                        ].map((opt) => opt.text && (
                          <div
                            key={opt.label}
                            className={`p-2 rounded-lg text-sm ${
                              opt.label === msg.parsed?.correctOption
                                ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-400"
                                : "bg-[#0f0f23] text-[#a0a0b8]"
                            }`}
                          >
                            <span className="font-bold mr-2">{opt.label}.</span>
                            {opt.text}
                            {opt.label === msg.parsed?.correctOption && (
                              <span className="ml-2 text-xs">✓ Correct</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {msg.parsed.answerFormat === "short_answer" && msg.parsed.correctAnswer && (
                      <div className="mb-3 p-2 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm">
                        <span className="font-semibold">Answer:</span> {msg.parsed.correctAnswer}
                      </div>
                    )}
                    <button
                      onClick={() => saveDraft(msg.content, i)}
                      disabled={savingDraft === i}
                      className="btn-primary text-xs"
                    >
                      {savingDraft === i ? "Saving..." : "Save to Drafts"}
                    </button>
                  </div>
                ) : (
                  <div className="max-w-[80%] p-3 rounded-xl text-sm bg-[#1e3a5f] text-[#e8e8e8]">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <button
                      onClick={() => saveDraft(msg.content, i)}
                      disabled={savingDraft === i}
                      className="mt-2 text-xs text-[#e94560] hover:text-[#e94560]/80"
                    >
                      {savingDraft === i ? "Saving..." : "Save to drafts"}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="text-sm text-[#666680] animate-pulse pl-2">
                Thinking...
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="input-field flex-1"
            placeholder="Ask about question ideas..."
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="btn-primary"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
