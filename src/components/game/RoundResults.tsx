"use client";

interface RoundResultsProps {
  round: {
    id: string;
    number: number;
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
      betAmount: number | null;
      selectedOption: string | null;
      freeTextAnswer: string | null;
      isCorrect: boolean | null;
      gradedBy: string | null;
      pointsWon: number;
      f1Points: number;
      placement: number | null;
      fastestLap: boolean;
      isAbsent: boolean;
      leaguePlayer: {
        id: string;
        fakeNickname: string | null;
        user: { id: string; nickname: string; avatarUrl: string | null; image: string | null };
      };
    }>;
    game: {
      season: { league: { roundsPerGame: number } };
    };
  };
  myPlayerId: string | null;
}

export default function RoundResults({ round, myPlayerId }: RoundResultsProps) {
  const sortedAnswers = [...round.answers].sort(
    (a, b) => (a.placement || 999) - (b.placement || 999)
  );

  const myAnswer = sortedAnswers.find(
    (a) => a.leaguePlayerId === myPlayerId
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card p-5 text-center">
        <p className="text-xs text-[#a0a0b8] uppercase tracking-[0.3em]">
          ROUND {round.number} COMPLETE
        </p>
        <div className="text-4xl mt-2 mb-3">&#127942;</div>

        {/* Personal result */}
        {myAnswer && (
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
              &middot; {myAnswer.f1Points} F1 pts
              {myAnswer.fastestLap && " ⚡ +1 Fastest Lap"}
            </p>
          </div>
        )}
      </div>

      {/* Question reveal */}
      {round.question && (
        <div className="card p-5">
          <p className="text-xs text-[#a0a0b8] uppercase tracking-wider mb-1">
            {round.question.category}
          </p>
          <p className="text-white font-medium mb-3">
            {round.question.questionText}
          </p>
          <p className="text-sm text-emerald-400">
            Correct answer:{" "}
            {round.question.answerFormat === "multiple_choice"
              ? `${round.question.correctOption}. ${getOptionText(round.question.correctOption)}`
              : round.question.correctAnswer}
          </p>
        </div>
      )}

      {/* Scorecard */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-[#a0a0b8] uppercase tracking-wider mb-3">
          Round Scorecard
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="table-header pb-2 w-8">#</th>
                <th className="table-header pb-2">Player</th>
                <th className="table-header pb-2 text-center">Result</th>
                <th className="table-header pb-2 text-right">Bet</th>
                <th className="table-header pb-2 text-right">+/-</th>
                <th className="table-header pb-2 text-right">F1</th>
              </tr>
            </thead>
            <tbody>
              {sortedAnswers.map((answer) => {
                const name =
                  answer.leaguePlayer.fakeNickname ||
                  answer.leaguePlayer.user.nickname;
                const isMe = answer.leaguePlayerId === myPlayerId;

                return (
                  <tr
                    key={answer.id}
                    className={`table-row ${isMe ? "bg-[#e94560]/5" : ""}`}
                  >
                    <td className="py-2.5">
                      <span
                        className={`font-bold ${
                          answer.placement === 1
                            ? "text-[#fbbf24]"
                            : answer.placement === 2
                              ? "text-gray-300"
                              : answer.placement === 3
                                ? "text-amber-700"
                                : "text-[#666680]"
                        }`}
                      >
                        {answer.placement || "-"}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm">
                          {name}
                          {isMe && (
                            <span className="text-xs text-[#e94560] ml-1">
                              (you)
                            </span>
                          )}
                        </span>
                        {answer.fastestLap && (
                          <span className="text-xs text-purple-400">
                            &#9889;
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 text-center">
                      {answer.isAbsent ? (
                        <span className="badge-absent">Absent</span>
                      ) : answer.isCorrect ? (
                        <span className="badge-correct">&#10003;</span>
                      ) : (
                        <span className="badge-incorrect">&#10007;</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-sm text-[#a0a0b8]">
                      {answer.betAmount || 0}
                    </td>
                    <td className="py-2.5 text-right">
                      <span
                        className={`text-sm font-bold ${
                          answer.pointsWon > 0
                            ? "text-emerald-400"
                            : answer.pointsWon < 0
                              ? "text-red-400"
                              : "text-[#666680]"
                        }`}
                      >
                        {answer.pointsWon > 0 ? "+" : ""}
                        {answer.pointsWon}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="text-sm font-bold text-[#fbbf24]">
                        {answer.f1Points}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
