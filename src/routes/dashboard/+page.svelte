<script lang="ts">
	let { data } = $props();
	const user = $derived(data.session?.user);
</script>

<div class="mx-auto max-w-2xl p-6">
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-gray-900">Profile</h1>
		<p class="mt-1 text-sm text-gray-500">Manage your account details.</p>
	</div>

	<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
		<div class="flex items-center gap-5">
			{#if user?.image}
				<img src={user.image} alt="Avatar" class="h-20 w-20 rounded-full shadow-sm ring-2 ring-gray-100" />
			{:else}
				<div
					class="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-3xl font-bold text-white shadow-sm"
				>
					{user?.name?.charAt(0).toUpperCase() || 'U'}
				</div>
			{/if}
			<div>
				<h2 class="text-xl font-semibold text-gray-900">{user?.name || 'User'}</h2>
				<p class="text-gray-500">{user?.email}</p>
				<span
					class="mt-2 inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20"
				>
					{user?.role || 'user'}
				</span>
			</div>
		</div>
	</div>

	<div class="mt-6 grid gap-4 sm:grid-cols-2">
		<a
			href="/dashboard/chat"
			class="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
		>
			<div
				class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
				</svg>
			</div>
			<h3 class="font-semibold text-gray-900">AI Chat</h3>
			<p class="mt-1 text-sm text-gray-500">Ask questions about your uploaded documents</p>
		</a>

		<a
			href="/dashboard/documents"
			class="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
		>
			<div
				class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
				</svg>
			</div>
			<h3 class="font-semibold text-gray-900">Knowledge Base</h3>
			<p class="mt-1 text-sm text-gray-500">Upload and manage your documents</p>
		</a>
	</div>
</div>
