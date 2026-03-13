import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { chats, messages, documentChunks, documents } from '$lib/server/db/schema';
import { cosineDistance, desc, gt, sql, eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });

export const POST: RequestHandler = async ({ request, fetch, locals }) => {
	const session = await locals.auth();
	if (!session?.user?.id) {
		return new Response('Unauthorized', { status: 401 });
	}

	const body = await request.json();
	const {
		chatId: existingChatId,
		message: userMessage,
		parentMessageId,
		regenerateAfterMessageId
	} = body;

	const isRegenerate = !!regenerateAfterMessageId;
	const chatId = existingChatId || crypto.randomUUID();
	const userMsgId = crypto.randomUUID();
	const assistantMsgId = crypto.randomUUID();

	// Create chat if new
	if (!existingChatId) {
		await db.insert(chats).values({
			id: chatId,
			userId: session.user.id,
			title: 'New Chat'
		});
	}

	// Build the conversation path up to the branch point
	let conversationMessages: { role: string; content: string }[] = [];
	let queryText = '';

	if (isRegenerate) {
		// Regenerating: find the user message and build path to it
		const allMsgs = await db
			.select()
			.from(messages)
			.where(eq(messages.chatId, chatId))
			.orderBy(messages.createdAt);

		const path = buildPathTo(allMsgs, regenerateAfterMessageId);
		conversationMessages = path.map((m) => ({ role: m.role, content: m.content }));
		const lastUserMsg = path.findLast((m) => m.role === 'user');
		queryText = lastUserMsg?.content || '';
	} else {
		// New message: save user message first
		await db.insert(messages).values({
			id: userMsgId,
			chatId,
			parentId: parentMessageId || null,
			role: 'user',
			content: userMessage
		});

		// Build conversation path
		const allMsgs = await db
			.select()
			.from(messages)
			.where(eq(messages.chatId, chatId))
			.orderBy(messages.createdAt);

		const path = buildPathTo(allMsgs, userMsgId);
		conversationMessages = path.map((m) => ({ role: m.role, content: m.content }));
		queryText = userMessage;
	}

	// RAG: Get relevant context via vector search
	let contextString = '';
	try {
		const apiUrl = env.EMBEDDING_API_URL || 'http://localhost:8000';
		const embedResponse = await fetch(`${apiUrl}/embed`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: queryText })
		});

		if (embedResponse.ok) {
			const { embedding: queryEmbedding } = await embedResponse.json();
			const similarity = sql<number>`1 - (${cosineDistance(documentChunks.embedding, queryEmbedding)})`;

			const relevantChunks = await db
				.select({
					content: documentChunks.content,
					similarity,
					filename: documents.filename
				})
				.from(documentChunks)
				.innerJoin(documents, eq(documentChunks.documentId, documents.id))
				.where(gt(similarity, 0.2))
				.orderBy((t) => desc(t.similarity))
				.limit(3);

			if (relevantChunks.length > 0) {
				contextString = relevantChunks
					.map((chunk) => `[Source: ${chunk.filename}]\n${chunk.content}`)
					.join('\n---\n');
			}
		}
	} catch (error) {
		console.error('Vector search failed:', error);
	}

	const systemPrompt = `You are a helpful AI assistant. Answer the user's questions based ONLY on the provided context below.
If the context does not contain the answer, say "I don't know based on the provided documents."
When you use information from a source, cite it like: [Source: filename.txt]
Format your responses using Markdown. Use code fences with language tags for code blocks.

CONTEXT:
${contextString || 'No relevant context found in the database.'}`;

	const parentForAssistant = isRegenerate ? regenerateAfterMessageId : userMsgId;

	const result = streamText({
		model: google('gemini-2.5-flash'),
		system: systemPrompt,
		messages: conversationMessages.map((m) => ({
			role: m.role as 'user' | 'assistant',
			content: m.content
		})),
		onFinish: async ({ text }) => {
			// Save assistant message
			await db.insert(messages).values({
				id: assistantMsgId,
				chatId,
				parentId: parentForAssistant,
				role: 'assistant',
				content: text
			});

			// Auto-title for new chats
			if (!existingChatId) {
				const title = queryText.length > 50 ? queryText.substring(0, 50) + '...' : queryText;
				await db
					.update(chats)
					.set({ title, updatedAt: new Date() })
					.where(eq(chats.id, chatId));
			} else {
				await db
					.update(chats)
					.set({ updatedAt: new Date() })
					.where(eq(chats.id, chatId));
			}
		}
	});

	return new Response(result.textStream, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'X-Chat-Id': chatId,
			'X-User-Message-Id': isRegenerate ? '' : userMsgId,
			'X-Assistant-Message-Id': assistantMsgId
		}
	});
};

// Build the message path from root to a specific message
function buildPathTo(
	allMessages: { id: string; parentId: string | null; role: string; content: string }[],
	targetId: string
): { id: string; parentId: string | null; role: string; content: string }[] {
	const msgMap = new Map(allMessages.map((m) => [m.id, m]));
	const path: typeof allMessages = [];
	let current = msgMap.get(targetId);

	while (current) {
		path.unshift(current);
		current = current.parentId ? msgMap.get(current.parentId) : undefined;
	}

	return path;
}
