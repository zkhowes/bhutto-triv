import { NextAuthOptions, getServerSession } from "next-auth";
import AppleProvider from "next-auth/providers/apple";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    AppleProvider({
      clientId: process.env.APPLE_ID || "",
      clientSecret: process.env.APPLE_SECRET || "",
      checks: ["state"],
      authorization: {
        params: {
          scope: "name email",
          response_type: "code",
          response_mode: "form_post",
        },
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
      }
      // Refresh user data from DB on every JWT creation/update
      if (token.id || trigger === "update") {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { profileComplete: true, nickname: true, isSuperAdmin: true },
        });
        token.profileComplete = dbUser?.profileComplete ?? false;
        token.nickname = dbUser?.nickname ?? null;
        token.isSuperAdmin = dbUser?.isSuperAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.id;
        (session.user as Record<string, unknown>).profileComplete =
          token.profileComplete;
        (session.user as Record<string, unknown>).nickname = token.nickname;
        (session.user as Record<string, unknown>).isSuperAdmin =
          token.isSuperAdmin;
      }
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name: "__Secure-next-auth.session-token",
      options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true, maxAge: 30 * 24 * 60 * 60 },
    },
    csrfToken: {
      name: "__Secure-next-auth.csrf-token",
      options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true },
    },
    callbackUrl: {
      name: "__Secure-next-auth.callback-url",
      options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true },
    },
    state: {
      name: "__Secure-next-auth.state",
      options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true, maxAge: 900 },
    },
    nonce: {
      name: "__Secure-next-auth.nonce",
      options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true },
    },
    pkceCodeVerifier: {
      name: "__Secure-next-auth.pkce.code_verifier",
      options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true, maxAge: 900 },
    },
  },
  debug: false,
  pages: {
    signIn: "/",
    error: "/auth-error",
  },
  events: {
    async signIn({ user }) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    },
  },
};

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user) return null;
  const userId = (session.user as Record<string, unknown>).id as string;
  return prisma.user.findUnique({ where: { id: userId } });
}
