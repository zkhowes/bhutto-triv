export const CATEGORIES = [
  "Geography",
  "Sports",
  "Politics",
  "Science",
  "History",
  "Entertainment",
  "Arts & Literature",
  "Food & Drink",
  "Technology",
  "General Knowledge",
] as const;

export type Category = (typeof CATEGORIES)[number];

// F1-style scoring for 10 players (standard scale)
export const F1_POINTS_SCALE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export const STARTING_POINTS = 20;

export const SKIP_PENALTY_PERCENTAGE = 0.5;

export const DEFAULT_SETTINGS = {
  gamesPerSeason: 3,
  maxPlayers: 10,
  dailyDeadline: "10:00",
  deadlineTimezone: "America/Los_Angeles",
  submissionWindowStart: "17:00",
  submissionWindowEnd: "07:00",
  categoryRevealTime: "07:00",
  absenteePenaltyType: "half" as const,
};

export const ROUND_STATUS = {
  PENDING: "pending",
  AWAITING_QUESTION: "awaiting_question",
  QUESTION_SUBMITTED: "question_submitted",
  CATEGORY_REVEALED: "category_revealed",
  CLOSED: "closed",
  GRADED: "graded",
  CANCELLED: "cancelled",
} as const;

export const GAME_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  COMPLETED: "completed",
} as const;

export const SEASON_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  PAUSED: "paused",
  COMPLETED: "completed",
} as const;

export const AWARD_TYPES = [
  { key: "mvp", label: "MVP", description: "Most total points" },
  {
    key: "iron_man",
    label: "Iron Man Award",
    description: "Perfect attendance",
  },
  {
    key: "offensive",
    label: "Offensive Player of the Year",
    description: "Biggest bets, consistent wins",
  },
  {
    key: "defensive",
    label: "Defensive Player of the Year",
    description: "Smallest bets, consistent wins",
  },
  {
    key: "comeback",
    label: "Comeback Player of the Year",
    description: "Most improvement from previous season",
  },
  {
    key: "rookie",
    label: "Rookie of the Year",
    description: "Best first-season player",
  },
  {
    key: "clutch",
    label: "Clutch Player",
    description: "Highest all-in win percentage",
  },
  {
    key: "strategist",
    label: "The Strategist",
    description: "Best risk/reward ratio",
  },
  {
    key: "most_improved",
    label: "Most Improved",
    description: "Biggest placement improvement",
  },
] as const;

export const NOTIFICATION_TYPES = {
  AT_BAT: "at_bat",
  CATEGORY_REVEAL: "category_reveal",
  REMINDER: "reminder",
  RESULTS: "results",
  SEASON_END: "season_end",
  INVITATION: "invitation",
} as const;
