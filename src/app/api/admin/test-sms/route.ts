import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendSms, isSmsConfigured } from "@/lib/sms";

const SAMPLE_MESSAGES: Record<string, { title: string; body: string }> = {
  at_bat: {
    title: "You're up – submit your question",
    body: "It's your turn in the Bhutto Wisdom league! Head to the game to submit your question for this round.",
  },
  new_question: {
    title: "New question ready – place your bets",
    body: "A new question has been posted in your league. Get your bets in before the deadline!",
  },
  all_answers_in: {
    title: "All answers are in – time to grade",
    body: "Everyone has submitted their answer. Head to the game to review and finalize the round.",
  },
  on_deck: {
    title: "You're on deck",
    body: "You're next up in your league's batting order. Start thinking about your question!",
  },
  round_results: {
    title: "Round results are in",
    body: "The latest round has been graded. See how everyone did and check the leaderboard.",
  },
  about_to_be_skipped: {
    title: "Deadline approaching – submit soon!",
    body: "You haven't submitted your bet and answer yet, and the round deadline is coming up fast. Don't get skipped!",
  },
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { to, type, appendText, adminPassword } = body as {
    to: string;
    type: string;
    appendText?: string;
    adminPassword?: string;
  };

  const correctPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!correctPassword || adminPassword !== correctPassword) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isSmsConfigured()) {
    return NextResponse.json(
      { error: "SMS is not configured. Add TWILIO_* environment variables." },
      { status: 400 }
    );
  }

  // (body already parsed above)

  if (!to || !to.trim()) {
    return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
  }

  const sample = SAMPLE_MESSAGES[type];
  if (!sample) {
    return NextResponse.json({ error: "Unknown notification type" }, { status: 400 });
  }

  const parts = [
    `[TEST] ${sample.title}`,
    "",
    sample.body,
  ];

  if (appendText?.trim()) {
    parts.push("", appendText.trim());
  }

  parts.push("", "— Bhutto Wisdom");

  const result = await sendSms(to.trim(), parts.join("\n"));

  if (result.success) {
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json({ error: result.error ?? "Failed to send" }, { status: 500 });
  }
}
