import twilio from "twilio";

let client: ReturnType<typeof twilio> | null = null;

function getClient(): ReturnType<typeof twilio> | null {
  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_FROM_NUMBER
  ) {
    return null;
  }
  if (!client) {
    client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return client;
}

export async function sendSms(
  to: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const smsClient = getClient();
  if (!smsClient) {
    // SMS not configured – silently skip (in-app only mode)
    return { success: false, error: "SMS not configured" };
  }

  const fromNumber = process.env.TWILIO_FROM_NUMBER!;

  // Normalize phone number – ensure E.164 format
  const normalized = to.startsWith("+") ? to : `+1${to.replace(/\D/g, "")}`;

  try {
    await smsClient.messages.create({
      body,
      from: fromNumber,
      to: normalized,
    });
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[SMS] Failed to send SMS:", error);
    return { success: false, error };
  }
}

export function isSmsConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}
