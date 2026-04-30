/**
 * Delete a league by id or name match, cascading all related rows.
 *
 * Usage (from bhutto-triv/):
 *   Dry run:  npx tsx scripts/delete-league.ts tl021726_01
 *   Execute:  npx tsx scripts/delete-league.ts tl021726_01 --apply
 *
 * Matches on League.id exact, or League.name contains (case-insensitive).
 * Refuses to run if more than one league matches — pass the exact id instead.
 */
import { PrismaClient } from "@prisma/client";
import { deleteLeagueCascade } from "../src/lib/league-delete";

const prisma = new PrismaClient();

async function main() {
  const query = process.argv[2];
  const apply = process.argv.includes("--apply");

  if (!query) {
    console.error("Usage: npx tsx scripts/delete-league.ts <id-or-name> [--apply]");
    process.exit(1);
  }

  const matches = await prisma.league.findMany({
    where: {
      OR: [
        { id: query },
        { name: { contains: query, mode: "insensitive" } },
      ],
    },
    include: {
      _count: {
        select: { players: true, seasons: true },
      },
    },
  });

  if (matches.length === 0) {
    console.log(`No league found matching "${query}"`);
    return;
  }

  console.log(`Found ${matches.length} match(es):`);
  for (const l of matches) {
    console.log(
      `  id=${l.id}  name="${l.name}"  inviteCode=${l.inviteCode}  ` +
        `players=${l._count.players}  seasons=${l._count.seasons}  ` +
        `isActive=${l.isActive}`,
    );
  }

  if (matches.length > 1) {
    console.error("\nMultiple matches. Re-run with the exact league id.");
    process.exit(1);
  }

  const target = matches[0];
  if (!apply) {
    console.log(
      `\nDry run. Re-run with --apply to delete league ${target.id} ("${target.name}").`,
    );
    return;
  }

  console.log(`\nDeleting league ${target.id} ("${target.name}")...`);
  await deleteLeagueCascade(target.id);
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
