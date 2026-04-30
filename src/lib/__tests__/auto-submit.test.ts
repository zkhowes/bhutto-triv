import { describe, it, expect, vi, beforeEach } from "vitest";

type Draft = {
  id: string;
  userId: string;
  questionText: string | null;
  category: string | null;
  answerFormat: string | null;
  useOnNextRound: boolean;
  updatedAt: Date;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctOption: string | null;
  correctAnswer: string | null;
  acceptableAnswers: string | null;
  imageUrl: string | null;
  imageSource: string | null;
  imageAttribution: string | null;
  orderingItems: string | null;
  orderingCorrectOrder: string | null;
  orderingDirection: string | null;
  orderingItemValues: string | null;
  originalQuestionId: string | null;
};

type Question = { questionText: string; creatorUserId: string; leagueId: string };

const mkDraft = (overrides: Partial<Draft>): Draft => ({
  id: overrides.id ?? "d1",
  userId: overrides.userId ?? "user-1",
  questionText: overrides.questionText ?? "What is 2+2?",
  category: overrides.category ?? "Math",
  answerFormat: overrides.answerFormat ?? "multiple_choice",
  useOnNextRound: overrides.useOnNextRound ?? true,
  updatedAt: overrides.updatedAt ?? new Date("2026-04-29T12:00:00Z"),
  optionA: overrides.optionA ?? "3",
  optionB: overrides.optionB ?? "4",
  optionC: overrides.optionC ?? "5",
  optionD: overrides.optionD ?? "6",
  correctOption: overrides.correctOption ?? "B",
  correctAnswer: overrides.correctAnswer ?? null,
  acceptableAnswers: overrides.acceptableAnswers ?? null,
  imageUrl: overrides.imageUrl ?? null,
  imageSource: overrides.imageSource ?? null,
  imageAttribution: overrides.imageAttribution ?? null,
  orderingItems: overrides.orderingItems ?? null,
  orderingCorrectOrder: overrides.orderingCorrectOrder ?? null,
  orderingDirection: overrides.orderingDirection ?? null,
  orderingItemValues: overrides.orderingItemValues ?? null,
  originalQuestionId: overrides.originalQuestionId ?? null,
});

// In-memory state set per-test
const state: { drafts: Draft[]; questions: Question[] } = { drafts: [], questions: [] };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    question: {
      findMany: vi.fn(async ({ where }: { where: { creatorUserId: string; round: { game: { season: { leagueId: string } } } } }) => {
        return state.questions
          .filter((q) => q.creatorUserId === where.creatorUserId && q.leagueId === where.round.game.season.leagueId)
          .map((q) => ({ questionText: q.questionText }));
      }),
    },
    questionDraft: {
      findMany: vi.fn(async ({ where, orderBy }: { where: { userId: string; useOnNextRound: boolean }; orderBy: { updatedAt: "desc" | "asc" } }) => {
        const filtered = state.drafts.filter(
          (d) =>
            d.userId === where.userId &&
            d.useOnNextRound === where.useOnNextRound &&
            d.category !== null &&
            d.questionText !== null &&
            d.answerFormat !== null
        );
        const sorted = [...filtered].sort((a, b) =>
          orderBy.updatedAt === "desc"
            ? b.updatedAt.getTime() - a.updatedAt.getTime()
            : a.updatedAt.getTime() - b.updatedAt.getTime()
        );
        return sorted;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Draft> }) => {
        const i = state.drafts.findIndex((d) => d.id === where.id);
        if (i >= 0) state.drafts[i] = { ...state.drafts[i], ...data };
        return state.drafts[i];
      }),
    },
  },
}));

// Import after the mock is registered
import { pickAutoSubmitDraft } from "../game-engine";

beforeEach(() => {
  state.drafts = [];
  state.questions = [];
  vi.clearAllMocks();
});

describe("pickAutoSubmitDraft", () => {
  it("returns the only eligible draft", async () => {
    state.drafts = [mkDraft({ id: "d1" })];
    const draft = await pickAutoSubmitDraft("user-1", "league-1");
    expect(draft?.id).toBe("d1");
  });

  it("returns null when there are no flagged drafts", async () => {
    state.drafts = [mkDraft({ id: "d1", useOnNextRound: false })];
    const draft = await pickAutoSubmitDraft("user-1", "league-1");
    expect(draft).toBeNull();
  });

  it("walks newest-first across multiple eligible drafts", async () => {
    state.drafts = [
      mkDraft({ id: "older", questionText: "Older Q", updatedAt: new Date("2026-04-01T00:00:00Z") }),
      mkDraft({ id: "newer", questionText: "Newer Q", updatedAt: new Date("2026-04-29T00:00:00Z") }),
    ];
    const draft = await pickAutoSubmitDraft("user-1", "league-1");
    expect(draft?.id).toBe("newer");
  });

  it("skips drafts already played in this league and clears their useOnNextRound flag", async () => {
    state.drafts = [
      mkDraft({ id: "played", questionText: "Played Q", updatedAt: new Date("2026-04-29T00:00:00Z") }),
      mkDraft({ id: "fresh", questionText: "Fresh Q", updatedAt: new Date("2026-04-28T00:00:00Z") }),
    ];
    state.questions = [
      { questionText: "Played Q", creatorUserId: "user-1", leagueId: "league-1" },
    ];

    const draft = await pickAutoSubmitDraft("user-1", "league-1");
    expect(draft?.id).toBe("fresh");

    // The played draft's flag should be cleared
    const played = state.drafts.find((d) => d.id === "played");
    expect(played?.useOnNextRound).toBe(false);
    // The fresh draft is left armed (the engine clears it after a successful submitQuestion)
    const fresh = state.drafts.find((d) => d.id === "fresh");
    expect(fresh?.useOnNextRound).toBe(true);
  });

  it("dedup is league-scoped — text played in a different league does not block", async () => {
    state.drafts = [mkDraft({ id: "d1", questionText: "Played Q" })];
    state.questions = [
      { questionText: "Played Q", creatorUserId: "user-1", leagueId: "league-OTHER" },
    ];

    const draft = await pickAutoSubmitDraft("user-1", "league-1");
    expect(draft?.id).toBe("d1");
  });

  it("dedup is case- and whitespace-insensitive", async () => {
    state.drafts = [mkDraft({ id: "d1", questionText: "  What Is The Capital Of France?  " })];
    state.questions = [
      { questionText: "what is the capital of france?", creatorUserId: "user-1", leagueId: "league-1" },
    ];

    const draft = await pickAutoSubmitDraft("user-1", "league-1");
    expect(draft).toBeNull();
    expect(state.drafts[0].useOnNextRound).toBe(false);
  });

  it("returns null and clears all flags when every queued draft is a duplicate", async () => {
    state.drafts = [
      mkDraft({ id: "d1", questionText: "A", updatedAt: new Date("2026-04-29T00:00:00Z") }),
      mkDraft({ id: "d2", questionText: "B", updatedAt: new Date("2026-04-28T00:00:00Z") }),
    ];
    state.questions = [
      { questionText: "A", creatorUserId: "user-1", leagueId: "league-1" },
      { questionText: "B", creatorUserId: "user-1", leagueId: "league-1" },
    ];

    const draft = await pickAutoSubmitDraft("user-1", "league-1");
    expect(draft).toBeNull();
    expect(state.drafts.every((d) => !d.useOnNextRound)).toBe(true);
  });

  it("does not return another user's drafts", async () => {
    state.drafts = [mkDraft({ id: "d1", userId: "user-2" })];
    const draft = await pickAutoSubmitDraft("user-1", "league-1");
    expect(draft).toBeNull();
  });
});
