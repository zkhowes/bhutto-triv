// Mosio SMS — uses plain HTTP, no external SDK required

export async function sendSms(
  to: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSmsConfigured()) {
    // SMS not configured – silently skip (in-app only mode)
    return { success: false, error: "SMS not configured" };
  }

  const apiKey = process.env.MOSIO_API_KEY!;
  const fromNumber = process.env.MOSIO_FROM_NUMBER;

  // Mosio requires 11-digit format: 15554443333 (no + prefix)
  const digits = to.replace(/\D/g, "");
  const normalized = digits.length === 10 ? `1${digits}` : digits;

  // Mosio max message length is 160 characters
  const message = body.length > 160 ? body.slice(0, 157) + "..." : body;

  const params = new URLSearchParams({
    Phone: normalized,
    Message: message,
    ...(fromNumber ? { FromNumber: fromNumber } : {}),
  });

  try {
    const res = await fetch("https://api.mosio.com/api/send_single_sms", {
      method: "POST",
      headers: {
        "X-ApiKey": apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (!data.Success || data.ErrorCode !== 0) {
      const error = data.ErrorMessage || `ErrorCode ${data.ErrorCode}`;
      console.error("[SMS] Mosio error:", error, data);
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[SMS] Failed to send SMS:", error);
    return { success: false, error };
  }
}

export function isSmsConfigured(): boolean {
  return !!process.env.MOSIO_API_KEY;
}
