import { NextAuthOptions, getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
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
  pages: {
    signIn: "/",
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
