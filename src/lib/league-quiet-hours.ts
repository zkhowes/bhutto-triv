import { prisma } from "@/lib/prisma";
import { DEFAULT_QUIET_HOURS_TZ, type QuietHoursConfig } from "@/lib/quiet-hours";

export interface LeagueQuietHoursContext {
  config: QuietHoursConfig;
  timezone: string;
}

export async function getLeagueQuietHoursContext(
  leagueId: string,
): Promise<LeagueQuietHoursContext | null> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { quietHoursEnabled: true, quietHoursStart: true, quietHoursEnd: true },
  });
  if (!league) return null;
  const comm = await prisma.leaguePlayer.findFirst({
    where: { leagueId, role: "commissioner", isActive: true },
    select: { user: { select: { timezone: true } } },
  });
  return {
    config: league,
    timezone: comm?.user?.timezone ?? DEFAULT_QUIET_HOURS_TZ,
  };
}

export function serializeQuietHours(ctx: LeagueQuietHoursContext | null) {
  if (!ctx) {
    return { enabled: false, start: 20, end: 7, timezone: DEFAULT_QUIET_HOURS_TZ };
  }
  return {
    enabled: ctx.config.quietHoursEnabled,
    start: ctx.config.quietHoursStart,
    end: ctx.config.quietHoursEnd,
    timezone: ctx.timezone,
  };
}
