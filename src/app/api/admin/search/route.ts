import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export interface SearchResult {
  id: string;
  type: "player" | "league" | "question" | "game";
  title: string;
  subtitle: string;
  metadata?: Record<string, any>;
}

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "20");

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Search across all entity types in parallel
    const [players, leagues, questions, games] = await Promise.all([
      // Search players by nickname or email
      prisma.user.findMany({
        where: {
          OR: [
            { nickname: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          nickname: true,
          email: true,
          createdAt: true,
          _count: { select: { leaguePlayers: true } },
        },
        take: Math.ceil(limit / 4),
      }),

      // Search leagues by name
      prisma.league.findMany({
        where: {
          name: { contains: query, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          type: true,
          isActive: true,
          _count: { select: { players: true } },
        },
        take: Math.ceil(limit / 4),
      }),

      // Search questions by text
      prisma.question.findMany({
        where: {
          questionText: { contains: query, mode: "insensitive" },
        },
        select: {
          id: true,
          questionText: true,
          category: true,
          round: {
            select: {
              game: {
                select: {
                  season: {
                    select: {
                      league: {
                        select: { name: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        take: Math.ceil(limit / 4),
      }),

      // Search games by ID (if query is numeric)
      isNaN(Number(query))
        ? []
        : prisma.game.findMany({
            where: {
              id: { contains: query },
            },
            select: {
              id: true,
              number: true,
              status: true,
              season: {
                select: {
                  number: true,
                  league: {
                    select: { name: true },
                  },
                },
              },
            },
            take: Math.ceil(limit / 4),
          }),
    ]);

    // Format results
    const results: SearchResult[] = [
      ...players.map((p) => ({
        id: p.id,
        type: "player" as const,
        title: p.nickname || p.email || "Unknown",
        subtitle: p.email || "",
        metadata: {
          leagues: p._count.leaguePlayers,
          joined: p.createdAt.toISOString(),
        },
      })),
      ...leagues.map((l) => ({
        id: l.id,
        type: "league" as const,
        title: l.name,
        subtitle: `${l.type} league • ${l._count.players} players`,
        metadata: {
          isActive: l.isActive,
        },
      })),
      ...questions.map((q) => ({
        id: q.id,
        type: "question" as const,
        title: q.questionText.substring(0, 100) + (q.questionText.length > 100 ? "..." : ""),
        subtitle: `${q.category} • ${q.round?.game.season.league.name || "Unknown League"}`,
        metadata: {
          category: q.category,
        },
      })),
      ...games.map((g) => ({
        id: g.id,
        type: "game" as const,
        title: `Game ${g.number}`,
        subtitle: `${g.season.league.name} • Season ${g.season.number} • ${g.status}`,
        metadata: {
          status: g.status,
        },
      })),
    ];

    return NextResponse.json({ results: results.slice(0, limit) });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    );
  }
}
