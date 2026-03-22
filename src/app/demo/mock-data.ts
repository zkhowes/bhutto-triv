export const MOCK_PLAYERS = [
  { id: "1", nickname: "SageBhutto", avatar: null, color: "#e94560" },
  { id: "2", nickname: "WiseMonk42", avatar: null, color: "#fbbf24" },
  { id: "3", nickname: "OraclePeak", avatar: null, color: "#10b981" },
  { id: "4", nickname: "You", avatar: null, color: "#3b82f6" },
];

export const MOCK_QUESTION = {
  category: "Geography",
  text: "What is the only country in the world that has a non-rectangular flag?",
  options: [
    { label: "A", value: "Switzerland" },
    { label: "B", value: "Nepal" },
    { label: "C", value: "Bhutan" },
    { label: "D", value: "Vatican City" },
  ],
  correctAnswer: "B",
  correctLabel: "Nepal",
};

export const MOCK_RESULTS = [
  {
    rank: 1,
    nickname: "You",
    bet: 15,
    correct: true,
    f1Points: 25,
    fastestLap: true,
    pointsWon: 15,
    color: "#3b82f6",
  },
  {
    rank: 2,
    nickname: "SageBhutto",
    bet: 12,
    correct: true,
    f1Points: 18,
    fastestLap: false,
    pointsWon: 12,
    color: "#e94560",
  },
  {
    rank: 3,
    nickname: "OraclePeak",
    bet: 8,
    correct: true,
    f1Points: 15,
    fastestLap: false,
    pointsWon: 8,
    color: "#10b981",
  },
  {
    rank: 4,
    nickname: "WiseMonk42",
    bet: 18,
    correct: false,
    f1Points: 12,
    fastestLap: false,
    pointsWon: -18,
    color: "#fbbf24",
  },
];

export const DEMO_CATEGORIES = [
  "Geography",
  "Science",
  "History",
  "Pop Culture",
  "Sports",
  "Literature",
];

export const WORKSHOP_CHIPS = [
  "Geography challenge",
  "Obscure history",
  "Sports stats",
  "Science stumper",
  "Pop culture",
  "Food & Drink",
];

export const WORKSHOP_VARIATIONS = [
  {
    category: "Geography",
    questionText:
      "What is the only country in the world that has a non-rectangular flag?",
    answerFormat: "multiple_choice" as const,
    optionA: "Switzerland",
    optionB: "Nepal",
    optionC: "Bhutan",
    optionD: "Vatican City",
    correctOption: "B",
    difficulty: "Medium" as const,
  },
  {
    category: "Geography",
    questionText:
      "Which landlocked country is home to eight of the ten tallest mountains on Earth?",
    answerFormat: "multiple_choice" as const,
    optionA: "Bhutan",
    optionB: "Tibet",
    optionC: "Nepal",
    optionD: "Afghanistan",
    correctOption: "C",
    difficulty: "Hard" as const,
  },
  {
    category: "Geography",
    questionText:
      "Kathmandu is the capital of which country?",
    answerFormat: "multiple_choice" as const,
    optionA: "Bangladesh",
    optionB: "Sri Lanka",
    optionC: "Bhutan",
    optionD: "Nepal",
    correctOption: "D",
    difficulty: "Easy" as const,
  },
];

export const MOCK_FUN_FACT =
  "Nepal's flag consists of two stacked triangles, making it the only national flag that isn't quadrilateral. The crimson red symbolizes bravery, and the blue border represents peace.";
