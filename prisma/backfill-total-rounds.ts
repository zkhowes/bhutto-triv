import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const games = await prisma.game.findMany({
    where: { totalRounds: 0 },
    include: {
      rounds: { where: { isCancelled: false } },
    },
  });

  console.log(`Found ${games.length} games with totalRounds=0`);

  for (const game of games) {
    const count = game.rounds.length;
    await prisma.game.update({
      where: { id: game.id },
      data: { totalRounds: count },
    });
    console.log(`  Game ${game.id}: set totalRounds=${count}`);
  }

  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
