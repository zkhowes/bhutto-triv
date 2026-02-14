import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const FAKE_NAMES = [
  "Lightning McQuiz",
  "Brain Storm",
  "Quiz Khalifa",
  "Trivia Newton",
  "Albert Quizstein",
  "Sherlock Homeworks",
  "Captain Smartypants",
  "The Quizzard of Oz",
  "Indiana Knowles",
];

// POST - Add fake test players
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Test mode only available in development" },
      { status: 400 }
    );
  }

  const leagueId = params.id;
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { players: { where: { isActive: true } } },
  });

  if (!league || league.type !== "test") {
    return NextResponse.json(
      { error: "Test mode not enabled for this league" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const count = Math.min(body.count || 3, league.maxPlayers - league.players.length);

  if (count <= 0) {
    return NextResponse.json(
      { error: "League is full" },
      { status: 400 }
    );
  }

  const existingFakeCount = league.players.filter((p) => p.isFake).length;
  const newPlayers = [];

  for (let i = 0; i < count; i++) {
    const nameIndex = existingFakeCount + i;
    const fakeName = FAKE_NAMES[nameIndex % FAKE_NAMES.length];

    // Create a separate fake User for each test player to avoid unique constraint on (leagueId, userId)
    const fakeUser = await prisma.user.create({
      data: {
        name: fakeName,
        nickname: fakeName,
        email: `fake-${Date.now()}-${i}@test.local`,
        profileComplete: true,
        timezone: "America/Los_Angeles",
      },
    });

    const player = await prisma.leaguePlayer.create({
      data: {
        leagueId,
        userId: fakeUser.id,
        role: "player",
        isFake: true,
        fakeNickname: fakeName,
      },
    });
    newPlayers.push(player);
  }

  return NextResponse.json(newPlayers, { status: 201 });
}
