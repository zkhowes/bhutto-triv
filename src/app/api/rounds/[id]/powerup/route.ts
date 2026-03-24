import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROUND_STATUS, POWER_UP_TYPE } from "@/lib/constants";
import { computePowerUpCost } from "@/lib/scoring";
import { generateHint, eliminateWrongOption } from "@/lib/ai";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roundId = params.id;
  const body = await req.json();
  const { leaguePlayerId, type, probeValue } = body as {
    leaguePlayerId: string;
    type: string;
    probeValue?: number;
  };

  if (!leaguePlayerId || !type) {
    return NextResponse.json(
      { error: "leaguePlayerId and type are required" },
      { status: 400 }
    );
  }

  if (!Object.values(POWER_UP_TYPE).includes(type as "hint" | "elimination" | "highlow" | "first_place")) {
    return NextResponse.json({ error: "Invalid power-up type" }, { status: 400 });
  }

  // Load round with question and the player's answer
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      question: true,
      answers: true,
      game: {
        include: {
          playerStates: true,
        },
      },
    },
  });

  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  if (round.status !== ROUND_STATUS.CATEGORY_REVEALED && round.status !== ROUND_STATUS.QUESTION_SUBMITTED) {
    return NextResponse.json(
      { error: "Power-ups are only available during the answer phase" },
      { status: 400 }
    );
  }

  const question = round.question;
  if (!question) {
    return NextResponse.json({ error: "No question found" }, { status: 400 });
  }

  // Verify the player is authorized (owns leaguePlayerId or is test-mode commissioner)
  const url = new URL(req.url);
  const actAsPlayerId = url.searchParams.get("actAs");
  const leaguePlayer = await prisma.leaguePlayer.findUnique({
    where: { id: leaguePlayerId },
  });
  if (!leaguePlayer) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  const isAuthorized =
    leaguePlayer.userId === session.user.id ||
    (actAsPlayerId === leaguePlayerId && leaguePlayer.userId === session.user.id);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check player's answer (bet must be placed)
  const roundAnswer = round.answers.find(
    (a) => a.leaguePlayerId === leaguePlayerId
  );
  if (!roundAnswer?.betPlacedAt || roundAnswer.betAmount == null) {
    return NextResponse.json(
      { error: "You must place a bet before buying a power-up" },
      { status: 400 }
    );
  }

  // One power-up per round enforcement
  if (roundAnswer.powerUpType) {
    return NextResponse.json(
      { error: "You have already used a power-up this round" },
      { status: 400 }
    );
  }

  // Get all active player points for parity pricing
  const allActivePoints = round.game.playerStates
    .filter((ps) => !ps.isEliminated)
    .map((ps) => ps.points);

  const playerState = round.game.playerStates.find(
    (ps) => ps.leaguePlayerId === leaguePlayerId
  );
  if (!playerState) {
    return NextResponse.json(
      { error: "Player state not found" },
      { status: 404 }
    );
  }

  const cost = computePowerUpCost(playerState.points, allActivePoints);

  // Check player can afford it (must have points remaining after bet)
  const availableAfterBet = playerState.points - roundAnswer.betAmount;
  if (availableAfterBet < cost) {
    return NextResponse.json(
      {
        error: `You need ${cost} points available after your bet to buy this power-up. You have ${availableAfterBet}.`,
      },
      { status: 400 }
    );
  }

  // Validate the power-up type matches the question format
  const validTypes: Record<string, string> = {
    multiple_choice: POWER_UP_TYPE.ELIMINATION,
    free_text: POWER_UP_TYPE.HINT,
    price_is_right: POWER_UP_TYPE.HIGHLOW,
    ordering: POWER_UP_TYPE.FIRST_PLACE,
  };
  if (validTypes[question.answerFormat] !== type) {
    return NextResponse.json(
      {
        error: `The "${type}" power-up is not available for this question type`,
      },
      { status: 400 }
    );
  }

  // Generate the power-up result
  let powerUpData: Record<string, unknown> = {};
  let resultForClient: Record<string, unknown> = {};

  if (type === POWER_UP_TYPE.HINT) {
    let acceptableAnswers: string[] = [];
    try {
      acceptableAnswers = question.acceptableAnswers
        ? JSON.parse(question.acceptableAnswers)
        : [];
    } catch {
      acceptableAnswers = [];
    }
    const hint = await generateHint(
      question.questionText,
      question.correctAnswer || "",
      acceptableAnswers
    );
    powerUpData = { hint };
    resultForClient = { hint };
  } else if (type === POWER_UP_TYPE.ELIMINATION) {
    const eliminated = await eliminateWrongOption(
      question.questionText,
      question.optionA || "",
      question.optionB || "",
      question.optionC || "",
      question.optionD || "",
      question.correctOption || "A"
    );
    powerUpData = { eliminatedOption: eliminated };
    resultForClient = { eliminatedOption: eliminated };
  } else if (type === POWER_UP_TYPE.HIGHLOW) {
    if (probeValue === undefined || probeValue === null) {
      return NextResponse.json(
        { error: "probeValue is required for High/Low power-up" },
        { status: 400 }
      );
    }
    const target = parseFloat(question.correctAnswer ?? "NaN");
    if (isNaN(target)) {
      return NextResponse.json(
        { error: "Invalid question — no numeric answer configured" },
        { status: 500 }
      );
    }
    const direction = probeValue > target ? "high" : probeValue < target ? "low" : "exact";
    powerUpData = { probeValue, direction };
    resultForClient = { direction };
  } else if (type === POWER_UP_TYPE.FIRST_PLACE) {
    const items: string[] = JSON.parse(question.orderingItems ?? "[]");
    const correctOrder: number[] = JSON.parse(question.orderingCorrectOrder ?? "[]");
    // Find which item is in position 1 (correctOrder[i] === 1 means item i is first)
    const firstItemIndex = correctOrder.indexOf(1);
    const firstItem = firstItemIndex >= 0 ? items[firstItemIndex] : null;
    powerUpData = { revealedPosition: 1, item: firstItem };
    resultForClient = { revealedPosition: 1, item: firstItem };
  }

  // Deduct cost from player's points
  await prisma.gamePlayerState.update({
    where: { id: playerState.id },
    data: {
      points: { decrement: cost },
    },
  });

  // Update RoundAnswer with power-up info
  await prisma.roundAnswer.update({
    where: { id: roundAnswer.id },
    data: {
      powerUpType: type,
      powerUpCost: cost,
      powerUpData: JSON.stringify(powerUpData),
    },
  });

  return NextResponse.json({ cost, result: resultForClient });
}
