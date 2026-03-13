import { SvelteKitAuth } from '@auth/sveltekit';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '$lib/server/db';
import { users, accounts, sessions, verificationTokens } from '$lib/server/db/schema';
import { AUTH_SECRET, GITHUB_ID, GITHUB_SECRET, GOOGLE_ID, GOOGLE_SECRET } from '$env/static/private';
import Credentials from '@auth/sveltekit/providers/credentials';
import GitHub from '@auth/sveltekit/providers/github';
import Google from '@auth/sveltekit/providers/google';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const { handle, signIn, signOut } = SvelteKitAuth({
	secret: AUTH_SECRET,
	adapter: DrizzleAdapter(db, {
		usersTable: users,
		accountsTable: accounts,
		sessionsTable: sessions,
		verificationTokensTable: verificationTokens
	}),
	session: {
		strategy: 'database'
	},
	providers: [
		GitHub({
			clientId: GITHUB_ID,
			clientSecret: GITHUB_SECRET
		}),
		Google({
			clientId: GOOGLE_ID,
			clientSecret: GOOGLE_SECRET
		}),
		Credentials({
			credentials: {
				email: { label: 'Email', type: 'email' },
				password: { label: 'Password', type: 'password' }
			},
			async authorize(credentials) {
				if (!credentials?.email || !credentials?.password) {
					return null;
				}

				// 1. Find the user in the database
				const [user] = await db
					.select()
					.from(users)
					.where(eq(users.email, credentials.email as string));

				if (!user || !user.password) {
					return null; // User not found or signed up via OAuth
				}

				// 2. Verify the password
				const passwordsMatch = await bcrypt.compare(
					credentials.password as string,
					user.password
				);

				if (!passwordsMatch) {
					return null; // Incorrect password
				}

				// 3. Login successful!
				return user;
			}
		})
	],
	callbacks: {
		async session({ session, user }) {
			if (session.user && user) {
				session.user.id = user.id;
				// @ts-expect-error - Adding role to standard Auth.js session type
				session.user.role = user.role;
			}
			return session;
		}
	}
});