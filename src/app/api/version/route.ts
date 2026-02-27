export async function GET() {
  return Response.json({
    sha: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    env: process.env.VERCEL_ENV ?? "development",
  });
}
