"use client";

import StarRating from "@/components/ui/StarRating";

interface RoundControlProps {
  round: {
    id: string;
    number: number;
    funFact?: string | null;
    atBatPlayerId?: string | null;
    questionScore?: {
      avgRating: number | null;
      successRate: number | null;
      composite: number | null;
    } | null;
    question: {
      category: string;
      questionText: string;
      answerFormat: string;
      correctOption: string | null;
      correctAnswer: string | null;
      optionA: string | null;
      optionB: string | null;
      optionC: string | null;
      optionD: string | null;
    } | null;
    answers: Array<{
      id: string;
      leaguePlayerId: string;
      isCorrect: boolean | null;
      pointsWon: number;
      placement: number | null;
      fastestLap: boolean;
      isAbsent: boolean;
      freeTextAnswer: string | null;
      questionRating: number | null;
      leaguePlayer: {
        id: string;
        fakeNickname: string | null;
        user: { id: string; nickname: string; avatarUrl: string | null; image: string | null };
      };
    }>;
  };
  myPlayerId: string | null;
}

export default function RoundControl({ round, myPlayerId }: RoundControlProps) {
  const myAnswer = round.answers.find((a) => a.leaguePlayerId === myPlayerId);
  const sortedAnswers = [...round.answers].sort(
    (a, b) => (a.placement || 999) - (b.placement || 999)
  );

  const getOptionText = (option: string | null) => {
    if (!round.question || !option) return "";
    switch (option) {
      case "A": return round.question.optionA;
      case "B": return round.question.optionB;
      case "C": return round.question.optionC;
      case "D": return round.question.optionD;
      default: return option;
    }
  };

  if (!round.question) return null;

  return (
    <div className="space-y-4">
      {/* Question + Answer + My Result */}
      <div className="card p-5">
        <p className="text-xs text-[#a0a0b8] uppercase tracking-wider mb-1">
          {round.question.category}
        </p>
        <p className="text-white font-medium mb-3">
          {round.question.questionText}
        </p>

        {/* Correct answer */}
        {round.question.answerFormat === "price_is_right" ? (
          <div>
            <p className="text-sm text-emerald-400">
              Target answer: {round.question.correctAnswer}
            </p>
            {(() => {
              const winner = sortedAnswers.find((a) => a.isCorrect);
              const winnerName = winner
                ? winner.leaguePlayer.fakeNickname || winner.leaguePlayer.user.nickname
                : null;
              const winnerGuess = winner?.freeTextAnswer;
              const target = parseFloat(round.question!.correctAnswer ?? "NaN");
              if (winner && winnerGuess) {
                return (
                  <p className="text-sm text-[#a0a0b8] mt-1">
                    Closest guess:{" "}
                    <span className="text-white font-semibold">{winnerGuess}</span>
                    {" "}by {winnerName}
                    {parseFloat(winnerGuess) === target && (
                      <span className="ml-1 text-emerald-400">(exact!)</span>
                    )}
                  </p>
                );
              }
              return (
                <p className="text-sm text-red-400 mt-1">
                  Everyone went over — nobody wins this round
                </p>
              );
            })()}
          </div>
        ) : (
          <p className="text-sm text-emerald-400">
            Correct answer:{" "}
            {round.question.answerFormat === "multiple_choice"
              ? `${round.question.correctOption}. ${getOptionText(round.question.correctOption)}`
              : round.question.correctAnswer}
          </p>
        )}

        {/* My result badge */}
        {myAnswer && (
          <div className="mt-4 pt-4 border-t border-[#1e3a5f]">
            <div
              className={`inline-block px-6 py-3 rounded-xl ${
                myAnswer.isCorrect
                  ? "bg-emerald-500/20 border border-emerald-500/30"
                  : "bg-red-500/20 border border-red-500/30"
              }`}
            >
              <p
                className={`text-lg font-bold ${
                  myAnswer.isCorrect ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {myAnswer.isCorrect ? "Correct!" : "Incorrect"}
              </p>
              <p className="text-sm text-[#a0a0b8]">
                {myAnswer.pointsWon > 0 ? "+" : ""}
                {myAnswer.pointsWon} points &middot; #{myAnswer.placement} place
                {myAnswer.fastestLap && (
                  <span className="text-purple-400 font-semibold ml-1">
                    ⚡ +1
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Question Quality Score */}
      {round.questionScore?.composite != null && (
        <div className="card p-4 text-center">
          <p className="text-xs text-[#a0a0b8] uppercase tracking-wider mb-2">
            Question Score
          </p>
          <div className="flex items-center justify-center gap-3">
            <StarRating value={round.questionScore.composite} size="sm" showLabel />
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 text-xs text-[#666680]">
            {round.questionScore.avgRating != null && (
              <span>Avg Rating: {round.questionScore.avgRating.toFixed(1)}/5</span>
            )}
            {round.questionScore.successRate != null && (
              <span>
                {Math.round(round.questionScore.successRate * 100)}% correct
              </span>
            )}
          </div>
        </div>
      )}

      {/* Did You Know? */}
      {round.funFact && (
        <div className="p-4 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-indigo-500/5">
          <p className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">
            Did You Know?
          </p>
          <p className="text-sm text-[#e8e8e8]">{round.funFact}</p>
        </div>
      )}
    </div>
  );
}
