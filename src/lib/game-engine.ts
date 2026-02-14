import { prisma } from "./prisma";
import {
  STARTING_POINTS,
  ROUND_STATUS,
  GAME_STATUS,
  SEASON_STATUS,
} from "./constants";
import { scoreRound, calculateAbsenteePenalty } from "./scoring";

/**
 * Initialize a new season for a league
 */
export async function initializeSeason(leagueId: string): Promise<string> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      seasons: { orderBy: { number: "desc" }, take: 1 },
      players: { where: { isActive: true } },
    },
  });

  if (!league) throw new Error("League not found");

  const nextSeasonNumber =
    league.seasons.length > 0 ? league.seasons[0].number + 1 : 1;

  const season = await prisma.season.create({
    data: {
      leagueId,
      number: nextSeasonNumber,
      status: SEASON_STATUS.ACTIVE,
      startedAt: new Date(),
    },
  });

  // Create first game
  await initializeGame(season.id, league.players.map((p) => p.id));

  return season.id;
}

/**
 * Initialize a new game within a season
 */
export async function initializeGame(
  seasonId: string,
  playerIds: string[]
): Promise<string> {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      games: { orderBy: { number: "desc" }, take: 1 },
      league: true,
    },
  });

  if (!season) throw new Error("Season not found");

  const nextGameNumber =
    season.games.length > 0 ? season.games[0].number + 1 : 1;

  const game = await prisma.game.create({
    data: {
      seasonId,
      number: nextGameNumber,
      status: GAME_STATUS.ACTIVE,
      startedAt: new Date(),
    },
  });

  // Shuffle batting order
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);

  // Create batting order
  await prisma.battingOrderEntry.createMany({
    data: shuffled.map((playerId, index) => ({
      gameId: game.id,
      leaguePlayerId: playerId,
      position: index,
    })),
  });

  // Create player states with starting points
  await prisma.gamePlayerState.createMany({
    data: playerIds.map((playerId) => ({
      gameId: game.id,
      leaguePlayerId: playerId,
      points: STARTING_POINTS,
      totalF1Points: 0,
      consecutiveMisses: 0,
    })),
  });

  // Create rounds
  const roundsPerGame = season.league.roundsPerGame;
  for (let i = 0; i < roundsPerGame; i++) {
    const atBatIndex = i % shuffled.length;
    const onDeckIndex = (i + 1) % shuffled.length;
    const inTheHoleIndex = (i + 2) % shuffled.length;

    await prisma.round.create({
      data: {
        gameId: game.id,
        number: i + 1,
        status: i === 0 ? ROUND_STATUS.AWAITING_QUESTION : ROUND_STATUS.PENDING,
        atBatPlayerId: shuffled[atBatIndex],
        onDeckPlayerId: shuffled[onDeckIndex],
        inTheHolePlayerId: shuffled[inTheHoleIndex],
      },
    });
  }

  return game.id;
}

/**
 * Submit a question for the current round
 */
export async function submitQuestion(
  roundId: string,
  questionData: {
    category: string;
    questionText: string;
    answerFormat: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctOption?: string;
    correctAnswer?: string;
    acceptableAnswers?: string[];
    leaguePlayerId: string;
    creatorUserId: string;
  }
): Promise<string> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { question: true },
  });

  if (!round) throw new Error("Round not found");
  if (round.question) throw new Error("Question already submitted for this round");

  const question = await prisma.question.create({
    data: {
      roundId,
      leaguePlayerId: questionData.leaguePlayerId,
      creatorUserId: questionData.creatorUserId,
      category: questionData.category,
      questionText: questionData.questionText,
      answerFormat: questionData.answerFormat,
      optionA: questionData.optionA,
      optionB: questionData.optionB,
      optionC: questionData.optionC,
      optionD: questionData.optionD,
      correctOption: questionData.correctOption,
      correctAnswer: questionData.correctAnswer,
      acceptableAnswers: questionData.acceptableAnswers
        ? JSON.stringify(questionData.acceptableAnswers)
        : null,
    },
  });

  // Update round status
  await prisma.round.update({
    where: { id: roundId },
    data: { status: ROUND_STATUS.QUESTION_SUBMITTED },
  });

  return question.id;
}

/**
 * Place a bet on a round
 */
export async function placeBet(
  roundId: string,
  leaguePlayerId: string,
  userId: string,
  betAmount: number
): Promise<string> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      question: true,
      game: {
        include: {
          playerStates: {
            where: { leaguePlayerId },
          },
        },
      },
    },
  });

  if (!round) throw new Error("Round not found");
  if (!round.question) throw new Error("No question submitted yet");
  if (
    round.status !== ROUND_STATUS.CATEGORY_REVEALED &&
    round.status !== ROUND_STATUS.QUESTION_SUBMITTED
  ) {
    throw new Error("Betting is not open for this round");
  }

  const playerState = round.game.playerStates[0];
  if (!playerState) throw new Error("Player not in this game");
  if (playerState.isEliminated)
    throw new Error("Player is eliminated from this game");
  if (betAmount < 1 || betAmount > playerState.points) {
    throw new Error(
      `Bet must be between 1 and ${playerState.points}`
    );
  }

  // Lock question editing once first bet is placed
  if (round.question.isEditable) {
    await prisma.question.update({
      where: { id: round.question.id },
      data: { isEditable: false },
    });
  }

  // Create or update answer record
  const answer = await prisma.roundAnswer.upsert({
    where: {
      roundId_leaguePlayerId: { roundId, leaguePlayerId },
    },
    update: {
      betAmount,
      betPlacedAt: new Date(),
    },
    create: {
      roundId,
      questionId: round.question.id,
      leaguePlayerId,
      userId,
      betAmount,
      betPlacedAt: new Date(),
    },
  });

  return answer.id;
}

/**
 * Submit an answer to a round's question
 */
export async function submitAnswer(
  roundId: string,
  leaguePlayerId: string,
  answer: {
    selectedOption?: string;
    freeTextAnswer?: string;
  }
): Promise<{ isCorrect: boolean | null; gradedBy: string }> {
  const roundAnswer = await prisma.roundAnswer.findUnique({
    where: {
      roundId_leaguePlayerId: { roundId, leaguePlayerId },
    },
    include: {
      question: true,
    },
  });

  if (!roundAnswer) throw new Error("Must place bet before answering");
  if (!roundAnswer.betAmount) throw new Error("Must place bet before answering");
  if (roundAnswer.answeredAt) throw new Error("Already answered");

  const question = roundAnswer.question;
  let isCorrect: boolean | null = null;
  let gradedBy = "pending";

  if (question.answerFormat === "multiple_choice") {
    isCorrect = answer.selectedOption === question.correctOption;
    gradedBy = "auto";
  } else {
    // Free text - use AI grading
    const { gradeAnswer: aiGrade } = await import("./ai");
    const acceptableAnswers = question.acceptableAnswers
      ? JSON.parse(question.acceptableAnswers)
      : [];
    const result = await aiGrade(
      question.questionText,
      question.correctAnswer || "",
      acceptableAnswers,
      answer.freeTextAnswer || ""
    );
    isCorrect = result.isCorrect;
    gradedBy = "ai";
  }

  await prisma.roundAnswer.update({
    where: { id: roundAnswer.id },
    data: {
      selectedOption: answer.selectedOption,
      freeTextAnswer: answer.freeTextAnswer,
      answeredAt: new Date(),
      isCorrect,
      gradedBy,
      aiGradeCorrect: gradedBy === "ai" ? isCorrect : null,
    },
  });

  // Auto-close round if all eligible (non-at-bat) players have answered
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      game: { include: { playerStates: true } },
    },
  });

  if (round) {
    const eligiblePlayerIds = round.game.playerStates
      .filter((ps) => !ps.isEliminated && ps.leaguePlayerId !== round.atBatPlayerId)
      .map((ps) => ps.leaguePlayerId);

    const answeredCount = await prisma.roundAnswer.count({
      where: {
        roundId,
        leaguePlayerId: { in: eligiblePlayerIds },
        answeredAt: { not: null },
      },
    });

    if (answeredCount >= eligiblePlayerIds.length) {
      // Set to "closed" (awaiting grading review by at-bat player)
      // instead of directly closing/grading the round
      await prisma.round.update({
        where: { id: roundId },
        data: { status: ROUND_STATUS.CLOSED },
      });
    }
  }

  return { isCorrect, gradedBy };
}

/**
 * Close a round and calculate scores
 */
export async function closeRound(roundId: string): Promise<void> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      answers: {
        include: {
          leaguePlayer: {
            include: {
              user: true,
            },
          },
        },
      },
      game: {
        include: {
          playerStates: true,
          battingOrder: true,
          rounds: { orderBy: { number: "asc" } },
          season: { include: { league: true } },
        },
      },
    },
  });

  if (!round) throw new Error("Round not found");

  const game = round.game;
  const league = game.season.league;

  // Mark absent players
  const allPlayerIds = game.playerStates.map((ps) => ps.leaguePlayerId);
  const answeredPlayerIds = round.answers.map((a) => a.leaguePlayerId);
  const absentPlayerIds = allPlayerIds.filter(
    (id) => !answeredPlayerIds.includes(id) && id !== round.atBatPlayerId
  );

  // Create absent records
  for (const playerId of absentPlayerIds) {
    const playerState = game.playerStates.find(
      (ps) => ps.leaguePlayerId === playerId
    );
    if (!playerState || playerState.isEliminated) continue;

    const remainingRounds =
      league.roundsPerGame - round.number;
    const penalty = calculateAbsenteePenalty(
      playerState.points,
      Math.max(remainingRounds, 1)
    );

    await prisma.roundAnswer.upsert({
      where: {
        roundId_leaguePlayerId: { roundId, leaguePlayerId: playerId },
      },
      update: {
        isAbsent: true,
        pointsWon: -penalty,
      },
      create: {
        roundId,
        questionId: round.answers[0]?.questionId || "",
        leaguePlayerId: playerId,
        userId: (
          await prisma.leaguePlayer.findUnique({
            where: { id: playerId },
          })
        )?.userId || "",
        isAbsent: true,
        pointsWon: -penalty,
      },
    });
  }

  // Get all answers including absent ones
  const allAnswers = await prisma.roundAnswer.findMany({
    where: { roundId },
    include: {
      leaguePlayer: {
        include: { user: true },
      },
    },
  });

  // Score the round
  const results = allAnswers.map((a) => ({
    leaguePlayerId: a.leaguePlayerId,
    isCorrect: a.isCorrect || false,
    betAmount: a.betAmount || 0,
    answeredAt: a.answeredAt,
    isAbsent: a.isAbsent,
    nickname:
      a.leaguePlayer.fakeNickname ||
      a.leaguePlayer.user.nickname ||
      a.leaguePlayer.user.name ||
      "",
  }));

  const scored = scoreRound(results);

  // Update answers with scoring data
  for (const score of scored) {
    const existingAnswer = allAnswers.find(
      (a) => a.leaguePlayerId === score.leaguePlayerId
    );
    if (!existingAnswer) continue;

    const betPointChange = existingAnswer.isAbsent
      ? existingAnswer.pointsWon
      : existingAnswer.isCorrect
        ? existingAnswer.betAmount || 0
        : -(existingAnswer.betAmount || 0);

    await prisma.roundAnswer.update({
      where: { id: existingAnswer.id },
      data: {
        placement: score.placement,
        f1Points: score.f1Points,
        pointsWon: betPointChange,
        fastestLap: score.fastestLap,
      },
    });

    // Update player state
    const playerState = game.playerStates.find(
      (ps) => ps.leaguePlayerId === score.leaguePlayerId
    );
    if (playerState) {
      const newPoints = Math.max(0, playerState.points + betPointChange);
      await prisma.gamePlayerState.update({
        where: { id: playerState.id },
        data: {
          points: newPoints,
          totalF1Points: playerState.totalF1Points + score.f1Points,
          isEliminated: newPoints === 0,
        },
      });
    }
  }

  // Update round status
  await prisma.round.update({
    where: { id: roundId },
    data: { status: ROUND_STATUS.GRADED },
  });

  // Check if game should end (all players at 0 or last round)
  const isLastRound = round.number >= league.roundsPerGame;
  const updatedStates = await prisma.gamePlayerState.findMany({
    where: { gameId: game.id },
  });
  const allEliminated = updatedStates.every((s) => s.isEliminated);

  if (isLastRound || allEliminated) {
    await prisma.game.update({
      where: { id: game.id },
      data: { status: GAME_STATUS.COMPLETED, completedAt: new Date() },
    });

    // Check if season should end
    const allGames = await prisma.game.findMany({
      where: { seasonId: game.seasonId },
    });
    if (allGames.length >= league.gamesPerSeason) {
      await prisma.season.update({
        where: { id: game.seasonId },
        data: {
          status: SEASON_STATUS.COMPLETED,
          completedAt: new Date(),
        },
      });
    }
  } else {
    // Activate next round
    const nextRound = game.rounds.find((r) => r.number === round.number + 1);
    if (nextRound) {
      await prisma.round.update({
        where: { id: nextRound.id },
        data: { status: ROUND_STATUS.AWAITING_QUESTION },
      });
    }
  }
}

/**
 * Reveal category for a round (transition from question_submitted to category_revealed)
 */
export async function revealCategory(roundId: string): Promise<void> {
  await prisma.round.update({
    where: { id: roundId },
    data: {
      status: ROUND_STATUS.CATEGORY_REVEALED,
      categoryRevealAt: new Date(),
    },
  });
}

/**
 * Skip a player's turn (Commissioner action)
 */
export async function skipPlayerTurn(
  roundId: string,
  leaguePlayerId: string
): Promise<void> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      game: {
        include: { battingOrder: { orderBy: { position: "asc" } } },
      },
    },
  });

  if (!round) throw new Error("Round not found");

  // Update consecutive misses
  const playerState = await prisma.gamePlayerState.findUnique({
    where: {
      gameId_leaguePlayerId: {
        gameId: round.gameId,
        leaguePlayerId,
      },
    },
  });

  if (playerState) {
    const newMisses = playerState.consecutiveMisses + 1;
    await prisma.gamePlayerState.update({
      where: { id: playerState.id },
      data: { consecutiveMisses: newMisses },
    });
  }

  // Move to next player in batting order
  const currentIndex = round.game.battingOrder.findIndex(
    (b) => b.leaguePlayerId === round.atBatPlayerId
  );
  const nextIndex =
    (currentIndex + 1) % round.game.battingOrder.length;
  const nextPlayer = round.game.battingOrder[nextIndex];

  await prisma.round.update({
    where: { id: roundId },
    data: {
      atBatPlayerId: nextPlayer.leaguePlayerId,
    },
  });
}
