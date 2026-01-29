import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      profileComplete: boolean;
      nickname: string | null;
      isSuperAdmin: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    profileComplete: boolean;
    nickname: string | null;
    isSuperAdmin: boolean;
  }
}
