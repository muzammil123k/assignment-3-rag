import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { documents, documentChunks } from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';
import type { Actions } from './$types';

// Helper function to split text into overlapping chunks
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
	default: async ({ request, fetch }) => {
		console.log("=== STARTING FILE UPLOAD ===");
		try {
			const data = await request.formData();
			const file = data.get('document') as File;
			
			console.log("1. File received in backend:", file?.name, "| Size:", file?.size);

			if (!file || file.size === 0) {
				console.log("❌ ERROR: File is empty or missing.");
				return fail(400, { error: 'Please upload a valid text file.' });
			}

			// Read the text file
			const content = await file.text();
			const filename = file.name;
			console.log("2. Text successfully read. Character count:", content.length);

			// Save the parent document to the database
			console.log("3. Attempting to save to 'documents' table in Postgres...");
			const [insertedDoc] = await db.insert(documents).values({
				filename,
				content
			}).returning();
			console.log("✅ Saved to DB! Document ID:", insertedDoc.id);

			// Split the text into chunks
			const textChunks = chunkText(content);
			console.log(`4. Text successfully chopped into ${textChunks.length} chunks.`);

			// Process each chunk
			for (let i = 0; i < textChunks.length; i++) {
				const chunkContent = textChunks[i];
				const apiUrl = env.EMBEDDING_API_URL || 'http://localhost:8000';
				console.log(`5. Sending chunk ${i + 1}/${textChunks.length} to Python API at ${apiUrl}...`);

				// Hit your Python Microservice for the embedding
				const response = await fetch(`${apiUrl}/embed`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ text: chunkContent })
				});

				if (!response.ok) {
					console.log(`❌ PYTHON API ERROR: Status ${response.status}`);
					throw new Error(`Failed to generate embedding from Python API. Status: ${response.status}`);
				}

				const responseData = await response.json();
				const embedding = responseData.embedding;

				console.log(`6. Received 768-dim vector. Saving chunk ${i + 1} to pgvector...`);
				// Save the chunk and its vector to pgvector
				await db.insert(documentChunks).values({
					documentId: insertedDoc.id,
					content: chunkContent,
					embedding,
					metadata: { chunkIndex: i }
				});
			}

			console.log("=== UPLOAD COMPLETELY SUCCESSFUL ===");
			return { success: true, message: `Successfully processed ${filename} into ${textChunks.length} embedded chunks!` };

		} catch (error) {
			console.error('!!! FATAL CATCH BLOCK ERROR !!!', error);
			return fail(500, { error: 'An error occurred during processing. Check your VS Code terminal.' });
		}
	}
};