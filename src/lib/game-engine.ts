import { prisma } from "./prisma";
import {
  STARTING_POINTS,
  ROUND_STATUS,
  GAME_STATUS,
  SEASON_STATUS,
  SKIP_PENALTY_PERCENTAGE,
  QUESTION_QUALITY_BONUS,
  FLAG_VOTE_THRESHOLD,
  FLAG_DISAGREE_PENALTY,
  MIN_PLAYERS_FOR_FLAG,
  isDefaultCategory,
} from "./constants";
import { scoreRound, calculateAbsenteePenalty, getF1PointsForPlacement, determinePirWinners, determineOrderingWinners } from "./scoring";
import {
  notifyAtBat,
  notifyNewQuestion,
  notifyAllAnswersIn,
  notifyOnDeck,
  notifyRoundResults,
  notifyFlagThrown,
  notifyFlagResolved,
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

  // Notify the first at-bat and on-deck players (fire-and-forget)
  if (firstRoundId) {
    notifyAtBat(firstRoundId).catch(console.error);
    notifyOnDeck(firstRoundId).catch(console.error);
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
    imageUrl?: string;
    imageSource?: string;
    imageAttribution?: string;
    orderingItems?: string[];
    orderingCorrectOrder?: number[];
    orderingDirection?: string;
  }
): Promise<string> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      question: true,
      game: { include: { season: true } },
    },
  });

  if (!round) throw new Error("Round not found");
  if (round.question) throw new Error("Question already submitted for this round");

  // Validate custom category
  const trimmedCategory = questionData.category.trim();
  if (!trimmedCategory || trimmedCategory.length > 50) {
    throw new Error("Category must be 1-50 characters");
  }

  // Validate ordering format data
  if (questionData.answerFormat === "ordering") {
    if (!questionData.orderingItems || questionData.orderingItems.length < 3 || questionData.orderingItems.length > 4) {
      throw new Error("Ordering questions require 3-4 items");
    }
    if (!questionData.orderingCorrectOrder || questionData.orderingCorrectOrder.length !== questionData.orderingItems.length) {
      throw new Error("Ordering correct order must match number of items");
    }
    if (!questionData.orderingDirection || questionData.orderingDirection.trim().length === 0) {
      throw new Error("Ordering direction is required");
    }
  }

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
      imageUrl: questionData.imageUrl || null,
      imageSource: questionData.imageSource || null,
      imageAttribution: questionData.imageAttribution || null,
      orderingItems: questionData.orderingItems ? JSON.stringify(questionData.orderingItems) : null,
      orderingCorrectOrder: questionData.orderingCorrectOrder ? JSON.stringify(questionData.orderingCorrectOrder) : null,
      orderingDirection: questionData.orderingDirection || null,
    },
  });

  // Upsert custom category if not a default
  if (!isDefaultCategory(trimmedCategory)) {
    const leagueId = round.game.season.leagueId;
    await prisma.leagueCategory.upsert({
      where: {
        leagueId_name: { leagueId, name: trimmedCategory },
      },
      update: { usageCount: { increment: 1 } },
      create: {
        leagueId,
        name: trimmedCategory,
        createdById: questionData.leaguePlayerId,
      },
    });
  }

  // Update round status
  await prisma.round.update({
    where: { id: roundId },
    data: { status: ROUND_STATUS.QUESTION_SUBMITTED },
  });

  // Notify all other players that a new question is ready (fire-and-forget)
  notifyNewQuestion(roundId).catch(console.error);

  return question.id;
}

/**
 * Place a bet on a round
 */
export async function placeBet(
  roundId: string,
  leaguePlayerId: string,
  userId: string,
  betAmount: number,
  isBlindBet: boolean = false
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

  // Blind bet validation
  if (isBlindBet) {
    if (round.status !== ROUND_STATUS.QUESTION_SUBMITTED) {
      throw new Error("Blind bet can only be placed before category is revealed");
    }
    if (round.atBatPlayerId === leaguePlayerId) {
      throw new Error("Cannot blind bet on your own at-bat round");
    }
    if (playerState.blindBetUsed) {
      throw new Error("Blind bet already used this game");
    }
  }

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
      isBlindBet,
    },
    create: {
      roundId,
      questionId: round.question.id,
      leaguePlayerId,
      userId,
      betAmount,
      betPlacedAt: new Date(),
      isBlindBet,
    },
  });

  // Mark blind bet as used on the player's game state
  if (isBlindBet) {
    await prisma.gamePlayerState.update({
      where: { id: playerState.id },
      data: { blindBetUsed: true },
    });
  }

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
    questionRating?: number;
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
  } else if (question.answerFormat === "ordering") {
    // Grading deferred to closeRound (needs all answers to determine competitive winners)
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
      questionRating: answer.questionRating ?? null,
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
        // Notify at-bat player that all answers are in and it's time to grade (fire-and-forget)
        notifyAllAnswersIn(roundId).catch(console.error);
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
          playerStates: {
            include: {
              leaguePlayer: { select: { isPaused: true } },
            },
          },
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

  // Mark absent players (exclude paused players — they're out of the game entirely)
  const activePlayerIds = game.playerStates
    .filter((ps) => !ps.leaguePlayer.isPaused)
    .map((ps) => ps.leaguePlayerId);
  const answeredPlayerIds = round.answers.map((a) => a.leaguePlayerId);
  const absentPlayerIds = activePlayerIds.filter(
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

  // Price is Right: determine winners (closest without going over) before scoring
  if (round.question?.answerFormat === "price_is_right") {
    const target = parseFloat(round.question.correctAnswer ?? "NaN");
    if (!isNaN(target)) {
      const guesses = allAnswers
        .filter((a) => !a.isAbsent)
        .map((a) => ({
          id: a.id,
          value: parseFloat(a.freeTextAnswer ?? "NaN"),
        }))
        .filter((g) => !isNaN(g.value));

      const winnerIds = determinePirWinners(target, guesses);

      for (const answer of allAnswers) {
        if (answer.isAbsent) continue;
        // Respect manual overrides (gradedBy already set by creator/commissioner)
        if (answer.gradedBy && answer.gradedBy !== "auto") continue;
        await prisma.roundAnswer.update({
          where: { id: answer.id },
          data: {
            isCorrect: winnerIds.has(answer.id),
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

  // Ordering: determine winners (most correct positions) before scoring
  if (round.question?.answerFormat === "ordering") {
    const correctOrder: number[] = JSON.parse(round.question.orderingCorrectOrder ?? "[]");
    const submissions = allAnswers
      .filter((a) => !a.isAbsent && a.freeTextAnswer)
      .map((a) => ({
        id: a.id,
        playerOrder: JSON.parse(a.freeTextAnswer!) as number[],
      }));

    const { winners } = determineOrderingWinners(correctOrder, submissions);

    for (const answer of allAnswers) {
      if (answer.isAbsent) continue;
      if (answer.gradedBy && answer.gradedBy !== "auto") continue;
      await prisma.roundAnswer.update({
        where: { id: answer.id },
        data: {
          isCorrect: winners.has(answer.id),
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

    const blindMultiplier = existingAnswer.isBlindBet ? 2 : 1;
    const rawBetPointChange = existingAnswer.isAbsent
      ? existingAnswer.pointsWon
      : existingAnswer.isCorrect
        ? (existingAnswer.betAmount || 0) * blindMultiplier
        : -(existingAnswer.betAmount || 0) * blindMultiplier;

    // Clamp negative betPointChange so player doesn't show losing more than they have
    const playerState = game.playerStates.find(
      (ps) => ps.leaguePlayerId === score.leaguePlayerId
    );
    const betPointChange = rawBetPointChange < 0 && playerState
      ? Math.max(rawBetPointChange, -playerState.points)
      : rawBetPointChange;

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
      let correctAnswerText = "";
      if (q.orderingItems && q.orderingDirection) {
        try {
          const items = JSON.parse(q.orderingItems) as string[];
          const order = q.orderingCorrectOrder ? JSON.parse(q.orderingCorrectOrder) as number[] : items.map((_, i) => i + 1);
          const sorted = order.map((pos, idx) => ({ pos, item: items[idx] })).sort((a, b) => a.pos - b.pos).map(e => e.item);
          correctAnswerText = `Correct order (${q.orderingDirection}): ${sorted.join(", ")}`;
        } catch {
          correctAnswerText = q.orderingItems;
        }
      } else if (q.correctAnswer) {
        correctAnswerText = q.correctAnswer;
      } else if (q.correctOption) {
        correctAnswerText = `${q.correctOption}. ${q.correctOption === "A" ? q.optionA : q.correctOption === "B" ? q.optionB : q.correctOption === "C" ? q.optionC : q.correctOption === "D" ? q.optionD : q.correctOption}`;
      } else {
        // Fallback for unknown future formats — give the AI whatever we have
        correctAnswerText = q.questionText;
      }
      funFact = await generateFunFact(
        q.questionText,
        correctAnswerText,
        q.category
      );
    }
  } catch (err) {
    console.error("Failed to generate fun fact:", err);
  }

  // Compute question composite score
  let questionComposite: number | null = null;
  {
    const { computeQuestionComposite } = await import("./scoring");
    // Re-fetch answers to get final state (including absentee records and ratings)
    const finalAnswers = await prisma.roundAnswer.findMany({
      where: { roundId },
    });
    const nonAtBatAnswers = finalAnswers.filter(
      (a) => a.leaguePlayerId !== round.atBatPlayerId && !a.isAbsent
    );
    const ratings = nonAtBatAnswers
      .map((a) => a.questionRating)
      .filter((r): r is number => r !== null);
    const avgRating = ratings.length > 0
      ? ratings.reduce((s, r) => s + r, 0) / ratings.length
      : null;
    questionComposite = computeQuestionComposite(
      avgRating,
      round.question?.answerFormat || "free_text",
      nonAtBatAnswers.map((a) => ({
        isCorrect: a.isCorrect,
        freeTextAnswer: a.freeTextAnswer,
      })),
      round.question?.correctAnswer || null
    );
  }

  // Update round status
  await prisma.round.update({
    where: { id: roundId },
    data: { status: ROUND_STATUS.GRADED, funFact, questionComposite },
  });

  // Notify all players of round results (fire-and-forget)
  notifyRoundResults(roundId).catch(console.error);

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
      notifyAtBat(nextRound.id).catch(console.error);
      notifyOnDeck(nextRound.id).catch(console.error);
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
    notifyAtBat(round.id).catch(console.error);
    notifyOnDeck(round.id).catch(console.error);

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
        notifyAtBat(nextPending.id).catch(console.error);
        notifyOnDeck(nextPending.id).catch(console.error);
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

// ─── Flag Challenge System ───────────────────────────────────────────────

/**
 * Throw a challenge flag on a graded round.
 * Validates eligibility, creates the review, pauses game if possible, notifies voters.
 */
export async function throwFlag(
  roundId: string,
  leaguePlayerId: string,
  objection: string
): Promise<{ flagReviewId: string }> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      flagReview: true,
      game: {
        include: {
          rounds: { orderBy: { number: "asc" } },
          playerStates: {
            include: {
              leaguePlayer: {
                include: { user: { select: { nickname: true, id: true } } },
              },
            },
          },
          season: { include: { league: { select: { id: true } } } },
        },
      },
    },
  });

  if (!round) throw new Error("Round not found");
  if (round.status !== ROUND_STATUS.GRADED) throw new Error("Can only flag a graded round");
  if (round.flagReview) throw new Error("This round already has a flag review");
  if (round.atBatPlayerId === leaguePlayerId) throw new Error("Cannot flag your own question");

  // Check flag window: no subsequent round should be graded
  const hasLaterGraded = round.game.rounds.some(
    (r) => r.number > round.number && !r.isCancelled && r.status === ROUND_STATUS.GRADED
  );
  if (hasLaterGraded) throw new Error("Flag window has closed — a later round is already graded");

  // Check player state
  const playerState = round.game.playerStates.find(
    (ps) => ps.leaguePlayerId === leaguePlayerId
  );
  if (!playerState) throw new Error("Player not in this game");
  if (playerState.leaguePlayer.isPaused) throw new Error("Paused players cannot throw flags");
  if (playerState.flagUsed) throw new Error("You already used your flag this game");

  // Check minimum players (no flags in heads-up) — paused excluded, busted still count
  const activePlayers = round.game.playerStates.filter((ps) => !ps.leaguePlayer.isPaused);
  if (activePlayers.length < MIN_PLAYERS_FOR_FLAG) {
    throw new Error(`Flags require at least ${MIN_PLAYERS_FOR_FLAG} active players`);
  }

  // Mark flag as used
  await prisma.gamePlayerState.update({
    where: { id: playerState.id },
    data: { flagUsed: true },
  });

  // Create the flag review
  const flagReview = await prisma.flagReview.create({
    data: {
      roundId,
      gameId: round.gameId,
      flaggedById: leaguePlayerId,
      objection,
      status: "pending",
    },
  });

  // Set round to under_review
  await prisma.round.update({
    where: { id: roundId },
    data: { status: ROUND_STATUS.UNDER_REVIEW },
  });

  // Pause game: if next round is still awaiting_question, revert to pending
  const nextRound = round.game.rounds.find(
    (r) => r.number > round.number && !r.isCancelled && r.status === ROUND_STATUS.AWAITING_QUESTION
  );
  if (nextRound) {
    await prisma.round.update({
      where: { id: nextRound.id },
      data: { status: ROUND_STATUS.PENDING },
    });
  }

  // If game was already completed (flag on last round), revert to active
  if (round.game.status === GAME_STATUS.COMPLETED) {
    await prisma.game.update({
      where: { id: round.gameId },
      data: { status: GAME_STATUS.ACTIVE, completedAt: null },
    });
  }

  // Get flagger name for notification
  const flaggerName =
    playerState.leaguePlayer.user.nickname || "A player";

  notifyFlagThrown(roundId, leaguePlayerId, flaggerName).catch(console.error);

  return { flagReviewId: flagReview.id };
}

/**
 * Get eligible voter count for a flag review.
 * Eligible = non-paused, non-flagger, non-at-bat (question maker).
 * Eliminated (busted) players CAN vote; only paused players are excluded.
 */
function getEligibleVoterIds(
  playerStates: Array<{ leaguePlayerId: string; isEliminated: boolean; leaguePlayer: { isPaused: boolean } }>,
  flaggedById: string,
  atBatPlayerId: string | null
): string[] {
  return playerStates
    .filter(
      (ps) =>
        !ps.leaguePlayer.isPaused &&
        ps.leaguePlayerId !== flaggedById &&
        ps.leaguePlayerId !== atBatPlayerId
    )
    .map((ps) => ps.leaguePlayerId);
}

/**
 * Submit a vote on a flag review. Auto-resolves when threshold is met.
 */
export async function submitFlagVote(
  flagReviewId: string,
  leaguePlayerId: string,
  vote: "agree" | "disagree",
  isProxy: boolean = false
): Promise<{ resolved: boolean; outcome?: string }> {
  const flagReview = await prisma.flagReview.findUnique({
    where: { id: flagReviewId },
    include: {
      votes: true,
      round: true,
      game: {
        include: {
          playerStates: {
            include: {
              leaguePlayer: {
                include: { user: { select: { nickname: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!flagReview) throw new Error("Flag review not found");
  if (flagReview.status !== "pending") throw new Error("Flag review already resolved");
  if (leaguePlayerId === flagReview.flaggedById) throw new Error("Flagger cannot vote");
  if (leaguePlayerId === flagReview.round.atBatPlayerId) throw new Error("Question maker cannot vote");

  // Check not already voted
  const existingVote = flagReview.votes.find((v) => v.leaguePlayerId === leaguePlayerId);
  if (existingVote) throw new Error("Already voted");

  // Verify voter is eligible (not paused)
  const voterState = flagReview.game.playerStates.find(
    (ps) => ps.leaguePlayerId === leaguePlayerId
  );
  if (!voterState) throw new Error("Player not in this game");
  if (voterState.leaguePlayer.isPaused) throw new Error("Paused players cannot vote on flags");

  await prisma.flagVote.create({
    data: {
      flagReviewId,
      leaguePlayerId,
      vote,
      isProxyVote: isProxy,
    },
  });

  // Check resolution
  const eligibleVoterIds = getEligibleVoterIds(
    flagReview.game.playerStates,
    flagReview.flaggedById,
    flagReview.round.atBatPlayerId
  );
  const totalEligible = eligibleVoterIds.length;
  const allVotes = [...flagReview.votes, { vote, leaguePlayerId }];
  const agreeCount = allVotes.filter((v) => v.vote === "agree").length;
  const disagreeCount = allVotes.filter((v) => v.vote === "disagree").length;
  const threshold = Math.ceil(totalEligible * FLAG_VOTE_THRESHOLD);

  if (agreeCount >= threshold) {
    await resolveFlagAgree(flagReview.id);
    return { resolved: true, outcome: "agreed" };
  }

  // If it's impossible to reach threshold (remaining votes can't push agree over)
  const remainingVotes = totalEligible - allVotes.length;
  if (agreeCount + remainingVotes < threshold) {
    await resolveFlagDisagree(flagReview.id);
    return { resolved: true, outcome: "disagreed" };
  }

  // All voted but didn't hit threshold
  if (allVotes.length >= totalEligible) {
    if (agreeCount >= threshold) {
      await resolveFlagAgree(flagReview.id);
      return { resolved: true, outcome: "agreed" };
    } else {
      await resolveFlagDisagree(flagReview.id);
      return { resolved: true, outcome: "disagreed" };
    }
  }

  return { resolved: false };
}

/**
 * Resolve a flag review as agreed: reverse scoring, cancel round, handle skip logic.
 */
async function resolveFlagAgree(flagReviewId: string): Promise<void> {
  const flagReview = await prisma.flagReview.findUnique({
    where: { id: flagReviewId },
    include: {
      round: {
        include: {
          answers: true,
          game: {
            include: {
              rounds: { orderBy: { number: "asc" } },
              playerStates: {
                include: {
                  leaguePlayer: {
                    include: { user: { select: { nickname: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!flagReview) throw new Error("Flag review not found");

  const { round } = flagReview;
  const game = round.game;

  // 1. Reverse round scoring for all answers
  for (const answer of round.answers) {
    if (answer.pointsWon === 0) continue;
    const playerState = game.playerStates.find(
      (ps) => ps.leaguePlayerId === answer.leaguePlayerId
    );
    if (!playerState) continue;

    const reversedPoints = playerState.points - answer.pointsWon;
    await prisma.gamePlayerState.update({
      where: { id: playerState.id },
      data: {
        points: Math.max(0, reversedPoints),
        isEliminated: reversedPoints <= 0 ? playerState.isEliminated : false,
      },
    });
  }

  // 2. Cancel the round
  await prisma.round.update({
    where: { id: round.id },
    data: {
      status: ROUND_STATUS.CANCELLED,
      isCancelled: true,
    },
  });

  await prisma.game.update({
    where: { id: game.id },
    data: { totalRounds: { decrement: 1 } },
  });

  // 3. Handle question maker skip
  const atBatPlayerId = round.atBatPlayerId!;
  const atBatState = game.playerStates.find(
    (ps) => ps.leaguePlayerId === atBatPlayerId
  );

  if (atBatState) {
    if (atBatState.skipCount >= 1) {
      // 2nd+ skip: penalty, no new round
      const penalty = Math.floor(atBatState.points * SKIP_PENALTY_PERCENTAGE);
      const newPoints = Math.max(0, atBatState.points - penalty);
      await prisma.gamePlayerState.update({
        where: { id: atBatState.id },
        data: {
          skipCount: atBatState.skipCount + 1,
          points: newPoints,
          isEliminated: newPoints === 0,
        },
      });
    } else {
      // 1st skip: add a new round at the end for this player
      await prisma.gamePlayerState.update({
        where: { id: atBatState.id },
        data: { skipCount: 1 },
      });

      const maxRoundNumber = Math.max(...game.rounds.map((r) => r.number));
      await prisma.round.create({
        data: {
          gameId: game.id,
          number: maxRoundNumber + 1,
          status: ROUND_STATUS.PENDING,
          atBatPlayerId,
        },
      });

      await prisma.game.update({
        where: { id: game.id },
        data: { totalRounds: { increment: 1 } },
      });
    }
  }

  // 4. Mark flag review as agreed
  await prisma.flagReview.update({
    where: { id: flagReviewId },
    data: { status: "agreed", resolvedAt: new Date() },
  });

  // 5. Check game end or activate next round
  const updatedRounds = await prisma.round.findMany({
    where: { gameId: game.id },
    orderBy: { number: "asc" },
  });

  const remainingRounds = updatedRounds.filter(
    (r) => !r.isCancelled && r.status !== ROUND_STATUS.GRADED && r.status !== ROUND_STATUS.CANCELLED
  );

  if (remainingRounds.length === 0) {
    // Complete the game
    const finalStates = await prisma.gamePlayerState.findMany({
      where: { gameId: game.id },
    });
    const sortedByPoints = [...finalStates].sort((a, b) => b.points - a.points);
    for (let i = 0; i < sortedByPoints.length; i++) {
      const f1Points = getF1PointsForPlacement(i + 1, sortedByPoints.length);
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
    // Activate next pending round if needed
    const nextPending = remainingRounds.find(
      (r) => r.status === ROUND_STATUS.PENDING
    );
    const hasActiveRound = remainingRounds.some(
      (r) =>
        r.status !== ROUND_STATUS.PENDING &&
        r.status !== ROUND_STATUS.GRADED &&
        r.status !== ROUND_STATUS.CANCELLED
    );

    if (nextPending && !hasActiveRound) {
      await prisma.round.update({
        where: { id: nextPending.id },
        data: { status: ROUND_STATUS.AWAITING_QUESTION },
      });
      notifyAtBat(nextPending.id).catch(console.error);
      notifyOnDeck(nextPending.id).catch(console.error);
    }
  }

  // 6. Notify
  const flaggerState = game.playerStates.find(
    (ps) => ps.leaguePlayerId === flagReview.flaggedById
  );
  const flaggerName = flaggerState?.leaguePlayer.user.nickname || "A player";
  notifyFlagResolved(round.id, "agreed", flaggerName).catch(console.error);
}

/**
 * Resolve a flag review as disagreed: penalize flagger, restore round, unpause game.
 */
async function resolveFlagDisagree(flagReviewId: string): Promise<void> {
  const flagReview = await prisma.flagReview.findUnique({
    where: { id: flagReviewId },
    include: {
      round: {
        include: {
          game: {
            include: {
              rounds: { orderBy: { number: "asc" } },
              playerStates: {
                include: {
                  leaguePlayer: {
                    include: { user: { select: { nickname: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!flagReview) throw new Error("Flag review not found");

  const { round } = flagReview;
  const game = round.game;

  // 1. Penalize the flagger: lose 50% of current points
  const flaggerState = game.playerStates.find(
    (ps) => ps.leaguePlayerId === flagReview.flaggedById
  );

  if (flaggerState) {
    const penalty = Math.floor(flaggerState.points * FLAG_DISAGREE_PENALTY);
    const newPoints = Math.max(0, flaggerState.points - penalty);
    await prisma.gamePlayerState.update({
      where: { id: flaggerState.id },
      data: {
        points: newPoints,
        isEliminated: newPoints === 0,
      },
    });
  }

  // 2. Revert round status to graded
  await prisma.round.update({
    where: { id: round.id },
    data: { status: ROUND_STATUS.GRADED },
  });

  // 3. Mark flag review as disagreed
  await prisma.flagReview.update({
    where: { id: flagReviewId },
    data: { status: "disagreed", resolvedAt: new Date() },
  });

  // 4. Unpause game: if we paused a round, re-activate it
  const pausedRound = game.rounds.find(
    (r) =>
      r.number > round.number &&
      !r.isCancelled &&
      r.status === ROUND_STATUS.PENDING
  );

  // Only re-activate if there's no other active round
  if (pausedRound) {
    const hasActiveRound = game.rounds.some(
      (r) =>
        r.id !== pausedRound.id &&
        !r.isCancelled &&
        !([ROUND_STATUS.PENDING, ROUND_STATUS.GRADED, ROUND_STATUS.CANCELLED, ROUND_STATUS.UNDER_REVIEW] as string[]).includes(r.status)
    );

    if (!hasActiveRound) {
      await prisma.round.update({
        where: { id: pausedRound.id },
        data: { status: ROUND_STATUS.AWAITING_QUESTION },
      });
      notifyAtBat(pausedRound.id).catch(console.error);
      notifyOnDeck(pausedRound.id).catch(console.error);
    }
  }

  // 5. If game was completed and we reverted it, re-complete
  const allRounds = await prisma.round.findMany({
    where: { gameId: game.id },
  });
  const allDone = allRounds.every(
    (r) => r.isCancelled || r.status === ROUND_STATUS.GRADED
  );
  if (allDone && game.status === GAME_STATUS.ACTIVE) {
    const finalStates = await prisma.gamePlayerState.findMany({
      where: { gameId: game.id },
    });
    const sortedByPoints = [...finalStates].sort((a, b) => b.points - a.points);
    for (let i = 0; i < sortedByPoints.length; i++) {
      const f1Points = getF1PointsForPlacement(i + 1, sortedByPoints.length);
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
  }

  // 6. Notify
  const flaggerName = flaggerState?.leaguePlayer.user.nickname || "A player";
  notifyFlagResolved(round.id, "disagreed", flaggerName).catch(console.error);
}

/**
 * Commissioner force-closes a flag review based on current vote tally or override.
 */
export async function forceCloseFlagReview(
  flagReviewId: string,
  resolution: "agree" | "disagree"
): Promise<void> {
  const flagReview = await prisma.flagReview.findUnique({
    where: { id: flagReviewId },
  });

  if (!flagReview) throw new Error("Flag review not found");
  if (flagReview.status !== "pending") throw new Error("Flag review already resolved");

  if (resolution === "agree") {
    await resolveFlagAgree(flagReviewId);
  } else {
    await resolveFlagDisagree(flagReviewId);
  }
}
