import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Find all graded rounds where this user was the at-bat player
  const rounds = await prisma.round.findMany({
    where: {
      status: "graded",
      atBatPlayerId: {
        not: null,
      },
      question: {
        creatorUserId: userId,
      },
    },
    include: {
      question: {
        select: {
          category: true,
          questionText: true,
          answerFormat: true,
          correctOption: true,
          correctAnswer: true,
          optionA: true,
          optionB: true,
          optionC: true,
          optionD: true,
        },
      },
      answers: {
        include: {
          leaguePlayer: {
            include: {
              user: {
                select: {
                  nickname: true,
                  avatarUrl: true,
                  image: true,
                },
              },
            },
          },
        },
      },
      game: {
        select: {
          number: true,
          season: {
            select: {
              number: true,
              league: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const history = rounds.map((round) => {
    const nonAtBatAnswers = round.answers.filter(
      (a) => a.leaguePlayerId !== round.atBatPlayerId
    );
    const ratings = nonAtBatAnswers
      .map((a) => a.questionRating)
      .filter((r): r is number => r !== null);
    const avgRating = ratings.length > 0
      ? ratings.reduce((s, r) => s + r, 0) / ratings.length
      : null;
    const correctCount = nonAtBatAnswers.filter((a) => a.isCorrect && !a.isAbsent).length;
    const totalAnswered = nonAtBatAnswers.filter((a) => !a.isAbsent).length;
    const successRate = totalAnswered > 0 ? correctCount / totalAnswered : null;

    return {
      roundId: round.id,
      roundNumber: round.number,
      gameNumber: round.game.number,
      seasonNumber: round.game.season.number,
      leagueName: round.game.season.league.name,
      leagueId: round.game.season.league.id,
      question: round.question,
      avgRating,
      successRate,
      createdAt: round.createdAt,
      playerResults: nonAtBatAnswers.map((a) => ({
        name: a.leaguePlayer.fakeNickname || a.leaguePlayer.user.nickname,
        avatarUrl: a.leaguePlayer.user.avatarUrl || a.leaguePlayer.user.image,
        isCorrect: a.isCorrect,
        isAbsent: a.isAbsent,
        pointsWon: a.pointsWon,
        selectedOption: a.selectedOption,
        freeTextAnswer: a.freeTextAnswer,
        betAmount: a.betAmount,
        placement: a.placement,
        fastestLap: a.fastestLap,
        gradedBy: a.gradedBy,
        powerUpType: a.powerUpType,
        powerUpCost: a.powerUpCost,
        cheatSeekerData: a.cheatSeekerData,
        questionRating: a.questionRating,
      })),
    };
  });

  return NextResponse.json({ history });
}
