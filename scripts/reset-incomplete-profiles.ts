/**
 * One-shot: flip profileComplete=false for users with no phoneNumber.
 *
 * Reasoning: profileComplete is meant to gate the app behind a complete
 * profile, but historically users could end up with profileComplete=true while
 * phoneNumber=null (e.g. early signups before the phone field was required).
 * This is the population that's silently missing SMS notifications today.
 *
 * After this runs, those users get bounced to /profile on their next page
 * load (the JWT callback re-reads profileComplete from DB on every request).
 *
 * Default: dry-run. Pass --apply to execute.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const candidates = await prisma.user.findMany({
    where: {
      OR: [{ phoneNumber: null }, { phoneNumber: "" }],
      profileComplete: true,
    },
    select: {
      id: true,
      nickname: true,
      email: true,
      profileComplete: true,
      phoneNumber: true,
      _count: { select: { leaguePlayers: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${candidates.length} user(s) with profileComplete=true but no phone:\n`);
  for (const u of candidates) {
    console.log(
      `  - ${u.nickname ?? "(no nickname)"} <${u.email ?? "no email"}> · ${u._count.leaguePlayers} league(s)`
    );
  }

  if (candidates.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to flip profileComplete=false for these users.");
    return;
  }

  const result = await prisma.user.updateMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    data: { profileComplete: false },
  });

  console.log(`\nUpdated ${result.count} user(s). They will be redirected to /profile on next page load.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
