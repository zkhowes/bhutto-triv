export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
  return Response.json({
    sha,
    shortSha: sha === "local" ? "local" : sha.slice(0, 7),
    buildTime: process.env.NEXT_PUBLIC_BUILD_TIME ?? null,
    env: process.env.VERCEL_ENV ?? "development",
  });
}
