<script lang="ts">
	import { page } from '$app/state';

	const session = $derived(page.data.session);
</script>

<div class="flex min-h-screen flex-col bg-white">
	<!-- Navbar -->
	<nav class="border-b border-gray-100 px-6 py-4">
		<div class="mx-auto flex max-w-6xl items-center justify-between">
			<div class="flex items-center gap-2">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white"
				>
					R
				</div>
				<span class="text-lg font-semibold text-gray-900">RAG Chat</span>
			</div>
			<div class="flex items-center gap-3">
				{#if session?.user}
					<a
						href="/dashboard"
						class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
					>
						Dashboard
					</a>
				{:else}
					<a
						href="/login"
						class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
					>
						Sign In
					</a>
					<a
						href="/register"
						class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
					>
						Get Started
					</a>
				{/if}
			</div>
		</div>
	</nav>

	<!-- Hero -->
	<main class="flex flex-1 items-center justify-center px-6">
		<div class="mx-auto max-w-3xl text-center">
			<div
				class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600"
			>
				<svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
					/>
				</svg>
			</div>

			<h1 class="mb-4 text-5xl font-bold tracking-tight text-gray-900">
				AI-Powered
				<span class="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
					Knowledge Chat
				</span>
			</h1>

			<p class="mb-8 text-lg text-gray-600">
				Upload your documents and ask questions. Powered by pgvector semantic search, Google Gemini,
				and a Python embedding microservice for context-grounded answers with citations.
			</p>

			<div class="flex items-center justify-center gap-4">
				<a
					href={session?.user ? '/dashboard/chat' : '/register'}
					class="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 hover:shadow-md"
				>
					{session?.user ? 'Open Chat' : 'Get Started'}
				</a>
				<a
					href={session?.user ? '/dashboard/documents' : '/login'}
					class="rounded-xl bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-200"
				>
					{session?.user ? 'Manage Documents' : 'Sign In'}
				</a>
			</div>

			<!-- Feature cards -->
			<div class="mt-16 grid gap-6 text-left sm:grid-cols-3">
				<div class="rounded-xl border border-gray-100 bg-gray-50 p-5">
					<div class="mb-3 text-2xl">&#x1F50D;</div>
					<h3 class="mb-1 font-semibold text-gray-900">Semantic Search</h3>
					<p class="text-sm text-gray-500">
						pgvector-powered cosine similarity finds the most relevant chunks from your knowledge
						base.
					</p>
				</div>
				<div class="rounded-xl border border-gray-100 bg-gray-50 p-5">
					<div class="mb-3 text-2xl">&#x1F916;</div>
					<h3 class="mb-1 font-semibold text-gray-900">Context-Grounded AI</h3>
					<p class="text-sm text-gray-500">
						Gemini answers based only on your documents with source citations. No hallucinations.
					</p>
				</div>
				<div class="rounded-xl border border-gray-100 bg-gray-50 p-5">
					<div class="mb-3 text-2xl">&#x1F333;</div>
					<h3 class="mb-1 font-semibold text-gray-900">Branching Chats</h3>
					<p class="text-sm text-gray-500">
						Edit messages and regenerate responses to explore different conversation paths.
					</p>
				</div>
			</div>
		</div>
	</main>
</div>
