<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let uploading = $state(false);
</script>

<div class="mx-auto max-w-4xl p-6">
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-gray-900">Knowledge Base</h1>
		<p class="mt-1 text-sm text-gray-500">
			Upload documents to power the RAG-based AI chat. Files are chunked and embedded for semantic
			search.
		</p>
	</div>

	<!-- Upload form -->
	<div class="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-lg font-semibold text-gray-900">Upload Document</h2>

		<form
			method="POST"
			action="?/upload"
			enctype="multipart/form-data"
			use:enhance={() => {
				uploading = true;
				return async ({ update }) => {
					uploading = false;
					update();
				};
			}}
			class="space-y-4"
		>
			<div>
				<label for="document" class="mb-1.5 block text-sm font-medium text-gray-700"
					>Select a text file</label
				>
				<input
					type="file"
					id="document"
					name="document"
					accept=".txt,.md,.csv"
					required
					class="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
				/>
				<p class="mt-1 text-xs text-gray-400">Supported: .txt, .md, .csv</p>
			</div>

			<button
				type="submit"
				disabled={uploading}
				class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
			>
				{#if uploading}
					<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
						<circle
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
							class="opacity-25"
						></circle>
						<path
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							class="opacity-75"
						></path>
					</svg>
					Processing & Embedding...
				{:else}
					<svg
						class="h-4 w-4"
						fill="none"
						viewBox="0 0 24 24"
						stroke-width="1.5"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
						/>
					</svg>
					Upload & Process
				{/if}
			</button>
		</form>

		{#if form?.success}
			<div class="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-200">
				{form.message}
			</div>
		{/if}
		{#if form?.error}
			<div class="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
				{form.error}
			</div>
		{/if}
	</div>

	<!-- Document list -->
	<div class="rounded-xl border border-gray-200 bg-white shadow-sm">
		<div class="border-b border-gray-200 px-6 py-4">
			<h2 class="text-lg font-semibold text-gray-900">Uploaded Documents</h2>
			<p class="text-sm text-gray-500">{data.documents.length} document(s) in knowledge base</p>
		</div>

		{#if data.documents.length === 0}
			<div class="px-6 py-12 text-center">
				<svg
					class="mx-auto h-12 w-12 text-gray-300"
					fill="none"
					viewBox="0 0 24 24"
					stroke-width="1"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
					/>
				</svg>
				<p class="mt-3 text-sm text-gray-500">No documents uploaded yet</p>
			</div>
		{:else}
			<div class="divide-y divide-gray-100">
				{#each data.documents as doc}
					<div class="flex items-center justify-between px-6 py-4">
						<div class="flex items-center gap-3">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"
							>
								<svg
									class="h-5 w-5"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
									/>
								</svg>
							</div>
							<div>
								<p class="font-medium text-gray-900">{doc.filename}</p>
								<p class="text-xs text-gray-500">
									{doc.chunkCount} chunks &middot;
									{new Date(doc.createdAt).toLocaleDateString()}
								</p>
							</div>
						</div>
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="documentId" value={doc.id} />
							<button
								type="submit"
								class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
								aria-label="Delete document"
								title="Delete"
							>
								<svg
									class="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									stroke-width="1.5"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
									/>
								</svg>
							</button>
						</form>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
