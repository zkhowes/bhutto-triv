"use client";

interface QuestionPreviewCardProps {
  category: string;
  questionText: string;
  answerFormat: "multiple_choice" | "free_text" | "price_is_right" | "ordering";
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: string;
  correctAnswer?: string;
  orderingItems?: string[];
  orderingDirection?: string;
  difficulty: "easy" | "medium" | "hard";
  hook: string;
  selected?: boolean;
  compact?: boolean;
  onSelect?: () => void;
  imageUrl?: string;
  imageSearchTerm?: string;
  onImageClick?: () => void;
}

const difficultyColors = {
  easy: "bg-emerald-500/20 text-emerald-400",
  medium: "bg-amber-500/20 text-amber-400",
  hard: "bg-red-500/20 text-red-400",
};

const formatLabels: Record<string, string> = {
  multiple_choice: "MC",
  free_text: "Free Text",
  price_is_right: "PiR",
  ordering: "Order",
};

export default function QuestionPreviewCard({
  category,
  questionText,
  answerFormat,
  optionA,
  optionB,
  optionC,
  optionD,
  correctOption,
  correctAnswer,
  orderingItems,
  orderingDirection,
  difficulty,
  hook,
  selected = false,
  compact = false,
  onSelect,
  imageUrl,
  imageSearchTerm,
  onImageClick,
}: QuestionPreviewCardProps) {
  const options = [
    { key: "A", text: optionA },
    { key: "B", text: optionB },
    { key: "C", text: optionC },
    { key: "D", text: optionD },
  ].filter((o) => o.text);

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border transition-all ${
        onSelect ? "cursor-pointer" : ""
      } ${
        selected
          ? "border-[#e94560] ring-2 ring-[#e94560] bg-[#16162a]"
          : "border-[#1e3a5f] bg-[#16162a] hover:border-[#2a5a8f]"
      } ${compact ? "p-3" : "p-4"}`}
    >
      {/* Hook teaser */}
      {hook && !compact && (
        <p className="text-xs text-[#666680] italic mb-2">{hook}</p>
      )}

      {/* Category + difficulty + format badges */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className="text-xs text-[#a0a0b8] uppercase tracking-wider">
          {category}
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${difficultyColors[difficulty]}`}
        >
          {difficulty}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#1e3a5f] text-[#a0a0b8]">
          {formatLabels[answerFormat] || answerFormat}
        </span>
      </div>

      {/* Question text */}
      <h3
        className={`font-semibold text-white leading-relaxed ${
          compact ? "text-sm" : "text-lg"
        } ${compact ? "mb-2" : "mb-3"}`}
      >
        {questionText}
      </h3>

      {/* Image preview */}
      {imageUrl && (
        <div className="relative mb-3">
          <img
            src={imageUrl}
            alt="Question image"
            className="rounded-lg w-full max-h-48 object-cover cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onImageClick?.(); }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="absolute bottom-2 right-2 bg-black/60 text-xs text-blue-400 px-2 py-1 rounded">
            Click to change
          </span>
        </div>
      )}
      {!imageUrl && imageSearchTerm && (
        <button
          onClick={(e) => { e.stopPropagation(); onImageClick?.(); }}
          className="w-full mb-3 py-2 border border-dashed border-blue-500/50 rounded-lg text-blue-400 text-sm hover:bg-blue-500/10 transition-colors"
        >
          + Add suggested image
        </button>
      )}

      {/* Answer preview */}
      {answerFormat === "multiple_choice" && options.length > 0 && (
        <div className={`space-y-1.5 ${compact ? "" : "mb-1"}`}>
          {options.map((opt) => (
            <div
              key={opt.key}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${
                correctOption === opt.key
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                  : "border-[#1e3a5f] bg-[#0f0f23] text-[#a0a0b8]"
              }`}
            >
              <span className="font-bold mr-2">{opt.key}.</span>
              {opt.text}
            </div>
          ))}
        </div>
      )}

      {answerFormat === "free_text" && (
        <div className={compact ? "" : "mb-1"}>
          <div className="px-3 py-2 rounded-lg border border-[#1e3a5f] bg-[#0f0f23] text-sm text-[#444460]">
            Type your answer...
          </div>
          {correctAnswer && (
            <p className="mt-1.5 text-xs text-emerald-400">
              Answer: {correctAnswer}
            </p>
          )}
        </div>
      )}

      {answerFormat === "price_is_right" && (
        <div className={compact ? "" : "mb-1"}>
          <div className="px-3 py-2 rounded-lg border border-[#1e3a5f] bg-[#0f0f23] text-sm text-[#444460]">
            Enter your number...
          </div>
          {correctAnswer && (
            <p className="mt-1.5 text-xs text-emerald-400">
              Answer: {correctAnswer}
            </p>
          )}
          <p className="mt-1 text-[10px] text-[#666680]">
            Closest without going over wins
          </p>
        </div>
      )}

      {answerFormat === "ordering" && orderingItems && orderingItems.length > 0 && (
        <div className={compact ? "" : "mb-1"}>
          {orderingDirection && (
            <p className="text-[10px] text-[#666680] mb-1">
              Order: {orderingDirection}
            </p>
          )}
          <div className="space-y-1">
            {orderingItems.map((item, i) => (
              <div
                key={i}
                className="px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-400"
              >
                {i + 1}. {item}
              </div>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-[#666680]">
            Most correct positions wins
          </p>
        </div>
      )}
    </div>
  );
}
