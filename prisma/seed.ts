import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create a test super admin user
  const admin = await prisma.user.upsert({
    where: { email: "admin@bhuttowisdom.test" },
    update: {},
    create: {
      email: "admin@bhuttowisdom.test",
      name: "Super Admin",
      nickname: "Admin",
      phoneNumber: "+1555000000",
      timezone: "America/Los_Angeles",
      profileComplete: true,
      isSuperAdmin: true,
    },
  });

  console.log(`Created admin user: ${admin.id}`);

  // Create test users
  const users = [];
  const names = [
    "Trivia Master",
    "Quiz Whiz",
    "Brain Storm",
    "Knowledge King",
    "Fact Finder",
  ];

  for (let i = 0; i < 5; i++) {
    const user = await prisma.user.upsert({
      where: { email: `player${i + 1}@bhuttowisdom.test` },
      update: {},
      create: {
        email: `player${i + 1}@bhuttowisdom.test`,
        name: names[i],
        nickname: names[i],
        phoneNumber: `+155500000${i + 1}`,
        timezone: "America/Los_Angeles",
        profileComplete: true,
      },
    });
    users.push(user);
  }

  console.log(`Created ${users.length} test users`);

  // Create a test league
  const league = await prisma.league.upsert({
    where: { inviteCode: "TESTLEAGUE" },
    update: {},
    create: {
      name: "Test Trivia League",
      type: "test",
      inviteCode: "TESTLEAGUE",
      maxPlayers: 10,
      gamesPerSeason: 5,
      roundsPerGame: 3,
    },
  });

  // Add players to league
  const commissioner = await prisma.leaguePlayer.upsert({
    where: {
      leagueId_userId: { leagueId: league.id, userId: admin.id },
    },
    update: { role: "commissioner" },
    create: {
      leagueId: league.id,
      userId: admin.id,
      role: "commissioner",
    },
  });

  const leaguePlayers = [commissioner];
  for (const user of users) {
    const lp = await prisma.leaguePlayer.upsert({
      where: {
        leagueId_userId: { leagueId: league.id, userId: user.id },
      },
      update: {},
      create: {
        leagueId: league.id,
        userId: user.id,
        role: "player",
      },
    });
    leaguePlayers.push(lp);
  }

  console.log(`League "${league.name}" created with ${leaguePlayers.length} players`);
  console.log(`Invite code: ${league.inviteCode}`);
  console.log("\nSeeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
