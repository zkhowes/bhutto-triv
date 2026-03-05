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

    const answers =
      question.round?.answers.map((a) => ({
        id: a.id,
        player: {
          nickname:
            a.leaguePlayer.user.nickname || a.leaguePlayer.user.email || "Unknown",
          email: a.leaguePlayer.user.email || "",
        },
        freeTextAnswer: a.freeTextAnswer,
        selectedOption: a.selectedOption,
        betAmount: a.betAmount || 0,
        isCorrect: a.isCorrect || false,
        pointsWon: a.pointsWon || 0,
        answeredAt: a.answeredAt,
      })) || [];

    return NextResponse.json({
      questionText: question.questionText,
      correctAnswer: question.correctAnswer,
      category: question.category,
      answerFormat: question.answerFormat,
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
