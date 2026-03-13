import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({
		name: 'assignment-3-rag',
		version: '1.0.0',
		description: 'RAG-powered AI Chat with pgvector'
	});
};
