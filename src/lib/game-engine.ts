import { prisma } from "./prisma";
import {
  STARTING_POINTS,
  ROUND_STATUS,
  GAME_STATUS,
  SEASON_STATUS,
  SKIP_PENALTY_PERCENTAGE,
  QUESTION_QUALITY_BONUS,
} from "./constants";
import { scoreRound, calculateAbsenteePenalty, getF1PointsForPlacement } from "./scoring";
import {
  notifyAtBat,
  notifyNewQuestion,
  notifyAllAnswersIn,
  notifyOnDeck,
  notifyRoundResults,
} from "./notifications";

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
      totalRounds: playerIds.length,
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
      skipCount: 0,
    })),
  });

  // Create rounds — one per player (each player bats exactly once)
  const roundsPerGame = playerIds.length;
  let firstRoundId: string | null = null;
  for (let i = 0; i < roundsPerGame; i++) {
    const atBatIndex = i % shuffled.length;
    const onDeckIndex = (i + 1) % shuffled.length;
    const inTheHoleIndex = (i + 2) % shuffled.length;

    const round = await prisma.round.create({
      data: {
        gameId: game.id,
        number: i + 1,
        status: i === 0 ? ROUND_STATUS.AWAITING_QUESTION : ROUND_STATUS.PENDING,
        atBatPlayerId: shuffled[atBatIndex],
        onDeckPlayerId: shuffled[onDeckIndex],
        inTheHolePlayerId: shuffled[inTheHoleIndex],
      },
    });
    if (i === 0) firstRoundId = round.id;
  }

  // Notify the first at-bat and on-deck players
  if (firstRoundId) {
    await notifyAtBat(firstRoundId);
    await notifyOnDeck(firstRoundId);
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

  // Notify all other players that a new question is ready
  await notifyNewQuestion(roundId);

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
    cheatSeekerData?: string;
  }
): Promise<{ isCorrect: boolean | null; gradedBy: string | null }> {
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
  let gradedBy: string | null = "pending";

  if (question.answerFormat === "multiple_choice") {
    isCorrect = answer.selectedOption === question.correctOption;
    gradedBy = "auto";
  } else if (question.answerFormat === "price_is_right") {
    // Grading deferred to closeRound (needs all answers to determine closest-without-going-over)
    isCorrect = null;
    gradedBy = null;
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
      cheatSeekerData: answer.cheatSeekerData || null,
    },
  });

  // Auto-close round if all eligible (non-at-bat) players have answered
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      game: {
        include: {
          playerStates: true,
          season: {
            include: {
              league: true,
            },
          },
        },
      },
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
      const isLightningMode = round.game.season.league.lightningMode;

      if (isLightningMode) {
        // Lightning Mode: AI has already graded, skip manual review and finalize immediately
        await closeRound(roundId);
      } else {
        // Normal Mode: Set to "closed" (awaiting grading review by at-bat player)
        await prisma.round.update({
          where: { id: roundId },
          data: { status: ROUND_STATUS.CLOSED },
        });
        // Notify at-bat player that all answers are in and it's time to grade
        await notifyAllAnswersIn(roundId);
      }
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
      question: true,
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

  // Create absent records for all non-participating players (including eliminated)
  for (const playerId of absentPlayerIds) {
    const playerState = game.playerStates.find(
      (ps) => ps.leaguePlayerId === playerId
    );
    if (!playerState) continue;

    // Calculate penalty only for non-eliminated players
    const penalty = playerState.isEliminated ? 0 : (() => {
      const remainingRounds = game.rounds.filter(
        (r) => !r.isCancelled && r.status !== ROUND_STATUS.GRADED && r.id !== roundId
      ).length;
      return calculateAbsenteePenalty(
        playerState.points,
        Math.max(remainingRounds, 1)
      );
    })();

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

  // Price is Right: determine winner (closest without going over) before scoring
  if (round.question?.answerFormat === "price_is_right") {
    const target = parseFloat(round.question.correctAnswer ?? "NaN");
    if (!isNaN(target)) {
      interface GuessEntry { id: string; value: number }
      const guesses: GuessEntry[] = allAnswers
        .filter((a) => !a.isAbsent)
        .map((a) => ({
          id: a.id,
          value: parseFloat(a.freeTextAnswer ?? "NaN"),
        }))
        .filter((g) => !isNaN(g.value));

      // Find exact match or closest without going over
      const underOrEqual = guesses.filter((g) => g.value <= target);
      const winnerId =
        underOrEqual.length === 0
          ? null
          : underOrEqual.sort((a, b) => b.value - a.value)[0].id;

      for (const answer of allAnswers) {
        if (answer.isAbsent) continue;
        await prisma.roundAnswer.update({
          where: { id: answer.id },
          data: {
            isCorrect: answer.id === winnerId,
            gradedBy: "auto",
          },
        });
      }

      // Refresh allAnswers after updating isCorrect
      const refreshed = await prisma.roundAnswer.findMany({
        where: { roundId },
        include: { leaguePlayer: { include: { user: true } } },
      });
      allAnswers.splice(0, allAnswers.length, ...refreshed);
    }
  }

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

    // Update player state (F1/season points are calculated at game end, not per round)
    const playerState = game.playerStates.find(
      (ps) => ps.leaguePlayerId === score.leaguePlayerId
    );
    if (playerState) {
      const newPoints = Math.max(0, playerState.points + betPointChange);
      await prisma.gamePlayerState.update({
        where: { id: playerState.id },
        data: {
          points: newPoints,
          isEliminated: newPoints === 0,
        },
      });
    }
  }

  // Generate fun fact
  let funFact: string | null = null;
  try {
    const roundWithQuestion = await prisma.round.findUnique({
      where: { id: roundId },
      include: { question: true },
    });
    if (roundWithQuestion?.question) {
      const { generateFunFact } = await import("./ai");
      const q = roundWithQuestion.question;
      funFact = await generateFunFact(
        q.questionText,
        q.correctAnswer || q.correctOption || "",
        q.category
      );
    }
  } catch (err) {
    console.error("Failed to generate fun fact:", err);
  }

  // Update round status
  await prisma.round.update({
    where: { id: roundId },
    data: { status: ROUND_STATUS.GRADED, funFact },
  });

  // Notify all players of round results
  await notifyRoundResults(roundId);

  // Check if game should end (all players at 0 or no remaining rounds)
  const remainingActiveRounds = game.rounds.filter(
    (r) => !r.isCancelled && r.status !== ROUND_STATUS.GRADED && r.id !== roundId
  ).length;
  const isLastRound = remainingActiveRounds === 0;
  const updatedStates = await prisma.gamePlayerState.findMany({
    where: { gameId: game.id },
  });
  const allEliminated = updatedStates.every((s) => s.isEliminated);

  if (isLastRound || allEliminated) {
    // Calculate F1/season points based on final game standings
    const finalStates = await prisma.gamePlayerState.findMany({
      where: { gameId: game.id },
    });
    // Sort by remaining points (descending) — higher points = better placement
    const sortedByPoints = [...finalStates].sort((a, b) => b.points - a.points);
    const totalPlayers = sortedByPoints.length;
    for (let i = 0; i < sortedByPoints.length; i++) {
      const placement = i + 1;
      const f1Points = getF1PointsForPlacement(placement, totalPlayers);
      await prisma.gamePlayerState.update({
        where: { id: sortedByPoints[i].id },
        data: { totalF1Points: f1Points },
      });
    }

    // Award question quality bonus before finalizing
    await awardQuestionQualityBonus(game.id);

    await prisma.game.update({
      where: { id: game.id },
      data: { status: GAME_STATUS.COMPLETED, completedAt: new Date() },
    });

    // Delete all notifications for this completed game
    await prisma.notification.deleteMany({
      where: { gameId: game.id },
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

      // Generate season awards
      try {
        const { generateSeasonAwards } = await import("./awards");
        await generateSeasonAwards(game.seasonId);
      } catch (err) {
        console.error("Failed to generate season awards:", err);
      }
    }
  } else {
    // Activate next non-cancelled pending round
    const nextRound = game.rounds.find(
      (r) => r.number > round.number && !r.isCancelled && r.status === ROUND_STATUS.PENDING
    );
    if (nextRound) {
      // Delete all notifications from the completed round
      await prisma.notification.deleteMany({
        where: { roundId: round.id },
      });

      await prisma.round.update({
        where: { id: nextRound.id },
        data: { status: ROUND_STATUS.AWAITING_QUESTION },
      });
      // Notify the new at-bat and on-deck players
      await notifyAtBat(nextRound.id);
      await notifyOnDeck(nextRound.id);
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
 * Two-strike system:
 *   First skip (skipCount was 0): move player to end of batting order
 *   Second skip (skipCount >= 1): 50% point penalty, cancel the round
 */
export async function skipPlayerTurn(
  roundId: string,
  leaguePlayerId: string
): Promise<{ cancelled: boolean }> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      game: {
        include: {
          rounds: { orderBy: { number: "asc" } },
          playerStates: true,
          battingOrder: { orderBy: { position: "asc" } },
          season: { include: { league: true } },
        },
      },
    },
  });

  if (!round) throw new Error("Round not found");

  const playerState = await prisma.gamePlayerState.findUnique({
    where: {
      gameId_leaguePlayerId: {
        gameId: round.gameId,
        leaguePlayerId,
      },
    },
  });

  if (!playerState) throw new Error("Player state not found");

  const game = round.game;

  if (playerState.skipCount === 0) {
    // ── FIRST SKIP: move skipped player to end of order ──
    await prisma.gamePlayerState.update({
      where: { id: playerState.id },
      data: { skipCount: 1 },
    });

    // Get all future pending rounds (after this one) that are not cancelled
    const futureRounds = game.rounds.filter(
      (r) => r.number > round.number && !r.isCancelled && r.status === ROUND_STATUS.PENDING
    );

    if (futureRounds.length === 0) {
      // No future rounds to shift into — this is the last round
      // Just swap with next player in batting order
      const nextPendingRound = game.rounds.find(
        (r) => r.number > round.number && !r.isCancelled
      );
      if (nextPendingRound) {
        // Swap at-bat players
        await prisma.round.update({
          where: { id: round.id },
          data: { atBatPlayerId: nextPendingRound.atBatPlayerId },
        });
        await prisma.round.update({
          where: { id: nextPendingRound.id },
          data: { atBatPlayerId: leaguePlayerId },
        });
      }
    } else {
      // Shift: current round gets next round's at-bat, each shifts forward, last gets skipped player
      const allAffectedRounds = [round, ...futureRounds];
      const newAtBatOrder: string[] = [];

      // Build new at-bat order: skip the current player, shift everyone else forward
      for (let i = 1; i < allAffectedRounds.length; i++) {
        newAtBatOrder.push(allAffectedRounds[i].atBatPlayerId!);
      }
      newAtBatOrder.push(leaguePlayerId); // Skipped player goes to end

      // Apply the new at-bat assignments
      for (let i = 0; i < allAffectedRounds.length; i++) {
        const r = allAffectedRounds[i];
        const newAtBat = newAtBatOrder[i];
        // Compute on-deck and in-the-hole from the subsequent rounds
        const onDeck = i + 1 < newAtBatOrder.length ? newAtBatOrder[i + 1] : null;
        const inTheHole = i + 2 < newAtBatOrder.length ? newAtBatOrder[i + 2] : null;

        await prisma.round.update({
          where: { id: r.id },
          data: {
            atBatPlayerId: newAtBat,
            onDeckPlayerId: onDeck,
            inTheHolePlayerId: inTheHole,
          },
        });
      }
    }

    // Notify the player now at bat for the current (reordered) round
    await notifyAtBat(round.id);
    await notifyOnDeck(round.id);

    return { cancelled: false };
  } else {
    // ── SECOND SKIP (or more): penalty + cancel round ──
    const penalty = Math.floor(playerState.points * SKIP_PENALTY_PERCENTAGE);
    const newPoints = Math.max(0, playerState.points - penalty);

    await prisma.gamePlayerState.update({
      where: { id: playerState.id },
      data: {
        skipCount: playerState.skipCount + 1,
        points: newPoints,
        isEliminated: newPoints === 0,
      },
    });

    // Mark round as cancelled
    await prisma.round.update({
      where: { id: roundId },
      data: {
        status: ROUND_STATUS.CANCELLED,
        isCancelled: true,
      },
    });

    // Decrement game totalRounds
    await prisma.game.update({
      where: { id: game.id },
      data: { totalRounds: { decrement: 1 } },
    });

    // Check if any remaining active rounds exist
    const remainingRounds = game.rounds.filter(
      (r) => r.id !== roundId && !r.isCancelled && r.status !== ROUND_STATUS.GRADED
    );

    if (remainingRounds.length === 0) {
      // No more rounds — complete the game with F1 scoring
      const finalStates = await prisma.gamePlayerState.findMany({
        where: { gameId: game.id },
      });
      const sortedByPoints = [...finalStates].sort((a, b) => b.points - a.points);
      const totalPlayers = sortedByPoints.length;
      for (let i = 0; i < sortedByPoints.length; i++) {
        const placement = i + 1;
        const f1Points = getF1PointsForPlacement(placement, totalPlayers);
        await prisma.gamePlayerState.update({
          where: { id: sortedByPoints[i].id },
          data: { totalF1Points: f1Points },
        });
      }
      await awardQuestionQualityBonus(game.id);
      await prisma.game.update({
        where: { id: game.id },
        data: { status: GAME_STATUS.COMPLETED, completedAt: new Date() },
      });
    } else {
      // Activate next pending round
      const nextPending = game.rounds.find(
        (r) => r.id !== roundId && !r.isCancelled && r.status === ROUND_STATUS.PENDING
      );
      if (nextPending) {
        await prisma.round.update({
          where: { id: nextPending.id },
          data: { status: ROUND_STATUS.AWAITING_QUESTION },
        });
        await notifyAtBat(nextPending.id);
        await notifyOnDeck(nextPending.id);
      }
    }

    return { cancelled: true };
  }
}

/**
 * Award bonus F1 points to the player with the highest average question rating in a game.
 * Called when a game completes.
 */
async function awardQuestionQualityBonus(gameId: string): Promise<void> {
  // Get all graded rounds in this game with their at-bat players and ratings
  const rounds = await prisma.round.findMany({
    where: { gameId, status: ROUND_STATUS.GRADED, isCancelled: false },
    select: {
      atBatPlayerId: true,
      answers: {
        where: { questionRating: { not: null } },
        select: { questionRating: true },
      },
    },
  });

  // Aggregate ratings by at-bat player
  const playerRatings: Map<string, number[]> = new Map();
  for (const round of rounds) {
    if (!round.atBatPlayerId) continue;
    const ratings = round.answers
      .map((a) => a.questionRating)
      .filter((r): r is number => r !== null);
    if (ratings.length === 0) continue;
    const existing = playerRatings.get(round.atBatPlayerId) || [];
    playerRatings.set(round.atBatPlayerId, [...existing, ...ratings]);
  }

  // Find player with highest avg (min 1 rated round)
  let bestPlayerId: string | null = null;
  let bestAvg = 0;
  playerRatings.forEach((ratings, playerId) => {
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestPlayerId = playerId;
    }
  });

  if (!bestPlayerId) return;

  // Award bonus points
  await prisma.gamePlayerState.updateMany({
    where: { gameId, leaguePlayerId: bestPlayerId },
    data: { totalF1Points: { increment: QUESTION_QUALITY_BONUS } },
  });
}
