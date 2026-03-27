import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

async function refreshAccessToken(token: any) {
  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    })
    const data = await resp.json()
    if (!resp.ok) throw data
    return {
      ...token,
      accessToken: data.access_token,
      accessTokenExpires: Date.now() + data.expires_in * 1000,
      refreshToken: data.refresh_token ?? token.refreshToken,
    }
  } catch {
    return { ...token, error: "RefreshAccessTokenError" }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days — extends on each visit
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        // First sign-in: store tokens and expiry
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
        }
      }
      // Token still valid
      if (Date.now() < ((token.accessTokenExpires as number) ?? 0)) {
        return token
      }
      // Expired — refresh silently
      return refreshAccessToken(token)
    },
    async session({ session, token }) {
      session.user.id = token.sub ?? ""
      ;(session as any).accessToken = token.accessToken
      ;(session as any).error = token.error
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})
