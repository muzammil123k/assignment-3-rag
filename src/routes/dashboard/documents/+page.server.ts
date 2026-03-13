import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { documents, documentChunks } from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';
import { eq, desc, count } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const docs = await db
		.select({
			id: documents.id,
			filename: documents.filename,
			createdAt: documents.createdAt,
			chunkCount: count(documentChunks.id)
		})
		.from(documents)
		.leftJoin(documentChunks, eq(documents.id, documentChunks.documentId))
		.groupBy(documents.id, documents.filename, documents.createdAt)
		.orderBy(desc(documents.createdAt));

	return { documents: docs };
};

function chunkText(text: string, chunkSize = 500, overlap = 50) {
	const chunks = [];
	let i = 0;
	while (i < text.length) {
		chunks.push(text.slice(i, i + chunkSize));
		i += chunkSize - overlap;
	}
	return chunks;
}

export const actions: Actions = {
	upload: async ({ request, fetch }) => {
		try {
			const data = await request.formData();
			const file = data.get('document') as File;

			if (!file || file.size === 0) {
				return fail(400, { error: 'Please upload a valid file.' });
			}

			const content = await file.text();
			const filename = file.name;

			const [insertedDoc] = await db
				.insert(documents)
				.values({ filename, content })
				.returning();

			const textChunks = chunkText(content);
			const apiUrl = env.EMBEDDING_API_URL || 'http://localhost:8000';

			for (let i = 0; i < textChunks.length; i++) {
				const response = await fetch(`${apiUrl}/embed`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ text: textChunks[i] })
				});

				if (!response.ok) {
					throw new Error(`Embedding API error: ${response.status}`);
				}

				const { embedding } = await response.json();

				await db.insert(documentChunks).values({
					documentId: insertedDoc.id,
					content: textChunks[i],
					embedding,
					metadata: { chunkIndex: i }
				});
			}

			return {
				success: true,
				message: `Processed "${filename}" into ${textChunks.length} embedded chunks.`
			};
		} catch (error) {
			console.error('Upload error:', error);
			return fail(500, { error: 'Processing failed. Is the embedding service running?' });
		}
	},

	delete: async ({ request }) => {
		const data = await request.formData();
		const docId = data.get('documentId') as string;

		if (!docId) return fail(400, { error: 'Missing document ID' });

		await db.delete(documents).where(eq(documents.id, docId));
		return { success: true, message: 'Document deleted.' };
	}
};
