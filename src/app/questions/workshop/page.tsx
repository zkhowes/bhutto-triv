"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import NavBar from "@/components/layout/NavBar";

export default function WorkshopPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

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
      setMessages([
        ...newMessages,
        { role: "assistant", content: data.response || "No response" },
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

  const saveDraft = async (text: string) => {
    try {
      await fetch("/api/questions/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionText: text }),
      });
      alert("Saved to drafts!");
    } catch {
      alert("Failed to save draft");
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
                <div
                  className={`max-w-[80%] p-3 rounded-xl text-sm ${
                    msg.role === "user"
                      ? "bg-[#e94560]/20 text-white"
                      : "bg-[#1e3a5f] text-[#e8e8e8]"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === "assistant" && (
                    <button
                      onClick={() => saveDraft(msg.content)}
                      className="mt-2 text-xs text-[#e94560] hover:text-[#e94560]/80"
                    >
                      Save to drafts
                    </button>
                  )}
                </div>
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
