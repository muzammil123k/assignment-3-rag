import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chats, messages } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

	// Verify chat belongs to user
	const [chat] = await db
		.select()
		.from(chats)
		.where(and(eq(chats.id, params.id), eq(chats.userId, session.user.id)));

	if (!chat) return json({ error: 'Not found' }, { status: 404 });

	const chatMessages = await db
		.select({
			id: messages.id,
			chatId: messages.chatId,
			parentId: messages.parentId,
			role: messages.role,
			content: messages.content,
			createdAt: messages.createdAt
		})
		.from(messages)
		.where(eq(messages.chatId, params.id))
		.orderBy(messages.createdAt);

	return json({ messages: chatMessages });
};
