<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();
	let uploading = $state(false);
</script>

<div class="max-w-2xl mx-auto mt-10 p-6 bg-white rounded-xl shadow-md border border-gray-100">
	<h1 class="text-2xl font-bold text-gray-900 mb-2">Knowledge Base Ingestion</h1>
	<p class="text-gray-600 mb-6">Upload text files to generate vector embeddings and power the AI chat.</p>

	<form 
		method="POST" 
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
			<label for="document" class="block text-sm font-medium text-gray-700">Select a .txt file</label>
			<input 
				type="file" 
				id="document" 
				name="document" 
				accept=".txt" 
				required 
				class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
			/>
		</div>

		<button 
			type="submit" 
			disabled={uploading}
			class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
		>
			{uploading ? 'Processing & Embedding...' : 'Upload & Process'}
		</button>
	</form>

	{#if form?.success}
		<div class="mt-4 p-4 bg-green-50 text-green-700 rounded-md border border-green-200">
			{form.message}
		</div>
	{/if}
	
	{#if form?.error}
		<div class="mt-4 p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
			{form.error}
		</div>
	{/if}
</div>