import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isAdminAuthenticated(session.user.id))) {
    return NextResponse.json(
      { error: "Super admin authentication required" },
      { status: 403 }
    );
  }

  const questionId = params.id;

  try {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        round: {
          include: {
            answers: {
              include: {
                leaguePlayer: {
                  include: {
                    user: {
                      select: {
                        nickname: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
            game: {
              include: {
                playerStates: {
                  select: {
                    leaguePlayerId: true,
                    points: true,
                    isEliminated: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Compute power-up eligibility context
    const answerFormat = question.answerFormat;
    const powerUpTypeForFormat: Record<string, string> = {
      multiple_choice: "elimination",
      free_text: "hint",
      price_is_right: "highlow",
    };
    const eligiblePowerUp = powerUpTypeForFormat[answerFormat] || null;
    const playerStates = question.round?.game?.playerStates || [];
    const activePoints = playerStates
      .filter((ps) => !ps.isEliminated)
      .map((ps) => ps.points);

    const answers =
      question.round?.answers.map((a) => {
        const ps = playerStates.find(
          (s) => s.leaguePlayerId === a.leaguePlayerId
        );
        const playerPoints = ps?.points ?? 0;
        const betAmount = a.betAmount || 0;
        const availableAfterBet = playerPoints - betAmount;

        // Determine power-up eligibility for this player
        let powerUpEligibility: string;
        if (a.isAbsent) {
          powerUpEligibility = "Not eligible: absent";
        } else if (!eligiblePowerUp) {
          powerUpEligibility = "Not eligible: unknown format";
        } else if (activePoints.length < 2) {
          powerUpEligibility = "Not eligible: not enough players";
        } else {
          // Compute what the cost would have been
          const sorted = [...activePoints].sort((a, b) => a - b);
          const rank = sorted.filter((p) => p <= playerPoints).length - 1;
          const ratio = sorted.length > 1 ? rank / (sorted.length - 1) : 0;
          const cost = Math.max(1, Math.ceil(1 + 7 * ratio));
          if (availableAfterBet < cost) {
            powerUpEligibility = `Not eligible: couldn't afford (cost ${cost}, had ${availableAfterBet} after bet)`;
          } else {
            powerUpEligibility = a.powerUpType
              ? "used"
              : `Passed (cost would have been ${cost}pt)`;
          }
        }

        return {
          id: a.id,
          player: {
            nickname:
              a.leaguePlayer.user.nickname ||
              a.leaguePlayer.user.email ||
              "Unknown",
            email: a.leaguePlayer.user.email || "",
          },
          freeTextAnswer: a.freeTextAnswer,
          selectedOption: a.selectedOption,
          betAmount,
          isCorrect: a.isCorrect || false,
          pointsWon: a.pointsWon || 0,
          answeredAt: a.answeredAt,
          isAbsent: a.isAbsent,
          powerUpType: a.powerUpType,
          powerUpCost: a.powerUpCost,
          powerUpData: a.powerUpData,
          powerUpEligibility,
        };
      }) || [];

    return NextResponse.json({
      questionText: question.questionText,
      correctAnswer: question.correctAnswer,
      category: question.category,
      answerFormat: question.answerFormat,
      eligiblePowerUp,
      answers,
    });
  } catch (error) {
    console.error("Question answers query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch question answers" },
      { status: 500 }
    );
  }
}
