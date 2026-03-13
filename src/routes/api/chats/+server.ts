import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chats } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

	const userChats = await db
		.select({
			id: chats.id,
			title: chats.title,
			createdAt: chats.createdAt,
			updatedAt: chats.updatedAt
		})
		.from(chats)
		.where(eq(chats.userId, session.user.id))
		.orderBy(desc(chats.updatedAt));

	return json({ chats: userChats });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	const title = body.title || 'New Chat';

	const [chat] = await db
		.insert(chats)
		.values({ userId: session.user.id, title })
		.returning();

	return json({ chat });
};
