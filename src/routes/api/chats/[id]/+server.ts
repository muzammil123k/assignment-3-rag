import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chats, messages } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

	const [chat] = await db
		.select()
		.from(chats)
		.where(and(eq(chats.id, params.id), eq(chats.userId, session.user.id)));

	if (!chat) return json({ error: 'Not found' }, { status: 404 });

	const chatMessages = await db
		.select()
		.from(messages)
		.where(eq(messages.chatId, params.id))
		.orderBy(messages.createdAt);

	return json({ chat, messages: chatMessages });
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

	const { title } = await request.json();

	await db
		.update(chats)
		.set({ title, updatedAt: new Date() })
		.where(and(eq(chats.id, params.id), eq(chats.userId, session.user.id)));

	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) return json({ error: 'Unauthorized' }, { status: 401 });

	await db
		.delete(chats)
		.where(and(eq(chats.id, params.id), eq(chats.userId, session.user.id)));

	return json({ success: true });
};
