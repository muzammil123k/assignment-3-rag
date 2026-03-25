<script lang="ts">
	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import { markedHighlight } from 'marked-highlight';
	import hljs from 'highlight.js';
	import DOMPurify from 'dompurify';

	// Configure marked with syntax highlighting
	marked.use(
		markedHighlight({
			langPrefix: 'hljs language-',
			highlight(code: string, lang: string) {
				const language = hljs.getLanguage(lang) ? lang : 'plaintext';
				return hljs.highlight(code, { language }).value;
			}
		})
	);

	// --- Types ---
	type DbMessage = {
		id: string;
		chatId: string;
		parentId: string | null;
		role: string;
		content: string;
		createdAt: string;
	};
	type ChatSummary = { id: string; title: string; createdAt: string; updatedAt: string };

	// --- State ---
	let chatList = $state<ChatSummary[]>([]);
	let currentChatId = $state<string | null>(null);
	let allMessages = $state<DbMessage[]>([]);
	let activeBranches = $state<Record<string, string>>({});
	let inputValue = $state('');
	let isStreaming = $state(false);
	let streamingText = $state('');
	let streamingMsgId = $state<string | null>(null);
	let historyOpen = $state(true);
	let historySearch = $state('');
	let editingId = $state<string | null>(null);
	let editText = $state('');
	let error = $state<string | null>(null);

	let chatContainer: HTMLDivElement;

	// --- Derived ---
	const activePath = $derived(getActivePath(allMessages, activeBranches));
	const filteredChats = $derived(
		historySearch
			? chatList.filter((c) => c.title.toLowerCase().includes(historySearch.toLowerCase()))
			: chatList
	);

	// --- Tree navigation ---
	function getActivePath(msgs: DbMessage[], branches: Record<string, string>): DbMessage[] {
		if (msgs.length === 0) return [];
		const roots = msgs.filter((m) => !m.parentId);
		if (roots.length === 0) return [];

		const activeRoot = branches['__root__'] ? msgs.find((m) => m.id === branches['__root__']) : roots[0];
		if (!activeRoot) return [];

		const path: DbMessage[] = [activeRoot];
		let current = activeRoot;

		while (true) {
			const children = msgs.filter((m) => m.parentId === current.id);
			if (children.length === 0) break;
			const activeChild = branches[current.id]
				? msgs.find((m) => m.id === branches[current.id])
				: children[0];
			if (!activeChild) break;
			path.push(activeChild);
			current = activeChild;
		}
		return path;
	}

	function getSiblings(msgId: string): DbMessage[] {
		const msg = allMessages.find((m) => m.id === msgId);
		if (!msg) return [];
		if (!msg.parentId) return allMessages.filter((m) => !m.parentId);
		return allMessages.filter((m) => m.parentId === msg.parentId);
	}

	function getSiblingIndex(msgId: string): { index: number; total: number } {
		const siblings = getSiblings(msgId);
		return { index: siblings.findIndex((m) => m.id === msgId), total: siblings.length };
	}

	function switchBranch(msgId: string, direction: number) {
		const msg = allMessages.find((m) => m.id === msgId);
		if (!msg) return;
		const siblings = getSiblings(msgId);
		const currentIdx = siblings.findIndex((m) => m.id === msgId);
		const newIdx = currentIdx + direction;
		if (newIdx < 0 || newIdx >= siblings.length) return;

		const newMsg = siblings[newIdx];
		const parentKey = msg.parentId || '__root__';
		activeBranches = { ...activeBranches, [parentKey]: newMsg.id };
	}

	// --- API calls ---
	async function loadChatList() {
		try {
			const res = await fetch('/api/chats');
			const data = await res.json();
			chatList = data.chats || [];
		} catch {
			console.error('Failed to load chats');
		}
	}

	async function loadChat(id: string) {
		currentChatId = id;
		allMessages = [];
		activeBranches = {};
		streamingText = '';
		error = null;

		try {
			const res = await fetch(`/api/chats/${id}`);
			const data = await res.json();
			allMessages = data.messages || [];
		} catch {
			error = 'Failed to load chat';
		}
		scrollToBottom();
	}

	async function deleteChat(id: string) {
		await fetch(`/api/chats/${id}`, { method: 'DELETE' });
		chatList = chatList.filter((c) => c.id !== id);
		if (currentChatId === id) {
			currentChatId = null;
			allMessages = [];
		}
	}

	function startNewChat() {
		currentChatId = null;
		allMessages = [];
		activeBranches = {};
		streamingText = '';
		error = null;
		inputValue = '';
	}

	async function sendMessage(text: string) {
		if (!text.trim() || isStreaming) return;
		const messageText = text.trim();
		inputValue = '';
		isStreaming = true;
		error = null;

		// Determine parent message ID (last message in active path)
		const path = activePath;
		const parentMessageId = path.length > 0 ? path[path.length - 1].id : null;

		// Optimistic: add user message to display
		const tempUserId = '__temp_user__';
		const tempAssistantId = '__temp_assistant__';
		allMessages = [
			...allMessages,
			{
				id: tempUserId,
				chatId: currentChatId || '',
				parentId: parentMessageId,
				role: 'user',
				content: messageText,
				createdAt: new Date().toISOString()
			}
		];
		if (parentMessageId) {
			activeBranches = { ...activeBranches, [parentMessageId]: tempUserId };
		}
		streamingText = '';
		streamingMsgId = tempAssistantId;
		scrollToBottom();

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					chatId: currentChatId,
					message: messageText,
					parentMessageId
				})
			});

			if (!res.ok) throw new Error(`Server error: ${res.status}`);

			const newChatId = res.headers.get('X-Chat-Id');
			const userMsgId = res.headers.get('X-User-Message-Id');
			const assistantMsgId = res.headers.get('X-Assistant-Message-Id');

			if (newChatId && !currentChatId) {
				currentChatId = newChatId;
			}

			// Stream the response
			const reader = res.body!.getReader();
			const decoder = new TextDecoder();
			let fullText = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const chunk = decoder.decode(value, { stream: true });
				fullText += chunk;
				streamingText = fullText;
				scrollToBottom();
			}

			// Replace temp messages with real ones
			allMessages = allMessages.map((m) => {
				if (m.id === tempUserId && userMsgId) {
					return { ...m, id: userMsgId, chatId: currentChatId! };
				}
				return m;
			});

			// Add the real assistant message
			const realAssistantMsg: DbMessage = {
				id: assistantMsgId || crypto.randomUUID(),
				chatId: currentChatId!,
				parentId: userMsgId || tempUserId,
				role: 'assistant',
				content: fullText,
				createdAt: new Date().toISOString()
			};
			allMessages = [...allMessages, realAssistantMsg];

			// Update branch pointers
			if (userMsgId && parentMessageId) {
				activeBranches = { ...activeBranches, [parentMessageId]: userMsgId };
			}
			if (userMsgId) {
				activeBranches = { ...activeBranches, [userMsgId]: realAssistantMsg.id };
			}

			streamingText = '';
			streamingMsgId = null;

			// Refresh chat list
			await loadChatList();
		} catch (e: any) {
			error = e.message || 'Failed to send message';
			// Remove temp user message on error
			allMessages = allMessages.filter((m) => m.id !== tempUserId);
		} finally {
			isStreaming = false;
			scrollToBottom();
		}
	}

	async function regenerateMessage(msgId: string) {
		if (isStreaming) return;
		const msg = allMessages.find((m) => m.id === msgId);
		if (!msg || msg.role !== 'assistant') return;

		// The user message this was a response to
		const userMsgId = msg.parentId;
		if (!userMsgId) return;

		isStreaming = true;
		error = null;
		streamingText = '';
		streamingMsgId = '__regen__';
		scrollToBottom();

		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					chatId: currentChatId,
					regenerateAfterMessageId: userMsgId
				})
			});

			if (!res.ok) throw new Error(`Server error: ${res.status}`);

			const assistantMsgId = res.headers.get('X-Assistant-Message-Id');

			const reader = res.body!.getReader();
			const decoder = new TextDecoder();
			let fullText = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				fullText += decoder.decode(value, { stream: true });
				streamingText = fullText;
				scrollToBottom();
			}

			const newAssistantMsg: DbMessage = {
				id: assistantMsgId || crypto.randomUUID(),
				chatId: currentChatId!,
				parentId: userMsgId,
				role: 'assistant',
				content: fullText,
				createdAt: new Date().toISOString()
			};
			allMessages = [...allMessages, newAssistantMsg];

			// Switch to the new branch
			activeBranches = { ...activeBranches, [userMsgId]: newAssistantMsg.id };

			streamingText = '';
			streamingMsgId = null;
		} catch (e: any) {
			error = e.message || 'Regeneration failed';
		} finally {
			isStreaming = false;
		}
	}

	async function editMessage(msgId: string, newText: string) {
		if (isStreaming || !newText.trim()) return;
		const msg = allMessages.find((m) => m.id === msgId);
		if (!msg || msg.role !== 'user') return;

		editingId = null;

		// Fork: the new message gets the SAME parent as the original,
		// so it becomes a sibling branch, not appended at the end.
		const forkParentId = msg.parentId;

		// Trim active path to end at the fork point's parent
		if (forkParentId) {
			// Temporarily override activeBranches so sendMessage sees the correct parent
			const pathToParent = getActivePath(allMessages, activeBranches);
			const parentIdx = pathToParent.findIndex((m) => m.id === forkParentId);
			if (parentIdx >= 0) {
				// Truncate activeBranches for children beyond the fork point
				const truncated = { ...activeBranches };
				for (const m of pathToParent.slice(parentIdx + 1)) {
					delete truncated[m.id];
				}
				// Remove the branch pointer so sendMessage picks forkParentId as last in path
				delete truncated[forkParentId];
				activeBranches = truncated;
			}
		} else {
			// Editing the very first message — clear all branches
			activeBranches = {};
		}

		await sendMessage(newText);
	}

	function startEdit(msgId: string) {
		const msg = allMessages.find((m) => m.id === msgId);
		if (!msg) return;
		editingId = msgId;
		editText = msg.content;
	}

	function cancelEdit() {
		editingId = null;
		editText = '';
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// Fallback
			const textarea = document.createElement('textarea');
			textarea.value = text;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
		}
	}

	function formatTime(dateStr: string) {
		try {
			return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		} catch {
			return '';
		}
	}

	function renderMarkdown(text: string): string {
		try {
			const raw = marked.parse(text) as string;
			return DOMPurify.sanitize(raw);
		} catch {
			return DOMPurify.sanitize(text);
		}
	}

	function scrollToBottom() {
		requestAnimationFrame(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage(inputValue);
		}
	}

	onMount(() => {
		loadChatList();
	});
</script>

<div class="flex h-full">
	<!-- History sidebar -->
	<div
		class="flex w-72 flex-col border-r border-gray-200 bg-white transition-all duration-200 max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-20 max-lg:shadow-xl {historyOpen
			? ''
			: 'max-lg:-translate-x-full'}"
	>
		<!-- Sidebar header -->
		<div class="flex items-center justify-between border-b border-gray-200 p-3">
			<h2 class="text-sm font-semibold text-gray-700">Chat History</h2>
			<button
				onclick={startNewChat}
				class="rounded-lg bg-indigo-600 p-1.5 text-white transition-colors hover:bg-indigo-700"
				aria-label="New chat"
				title="New Chat"
			>
				<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
			</button>
		</div>

		<!-- Search -->
		<div class="px-3 py-2">
			<input
				bind:value={historySearch}
				placeholder="Search chats..."
				class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
				aria-label="Search chat history"
			/>
		</div>

		<!-- Chat list -->
		<div class="chat-scroll flex-1 overflow-y-auto">
			{#if filteredChats.length === 0}
				<p class="px-3 py-6 text-center text-sm text-gray-400">No chats yet</p>
			{/if}
			{#each filteredChats as chat (chat.id)}
				<div class="group relative">
					<button
						onclick={() => loadChat(chat.id)}
						class="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 {currentChatId === chat.id
							? 'bg-indigo-50 text-indigo-700'
							: 'text-gray-700'}"
					>
						<svg
							class="mt-0.5 h-4 w-4 shrink-0 {currentChatId === chat.id
								? 'text-indigo-500'
								: 'text-gray-400'}"
							fill="none"
							viewBox="0 0 24 24"
							stroke-width="1.5"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
							/>
						</svg>
						<span class="line-clamp-2 flex-1">{chat.title}</span>
					</button>
					<button
						onclick={() => deleteChat(chat.id)}
						class="absolute right-2 top-2.5 hidden rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 group-hover:block"
						aria-label="Delete chat"
						title="Delete"
					>
						<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
						</svg>
					</button>
				</div>
			{/each}
		</div>
	</div>

	<!-- Main chat area -->
	<div class="flex flex-1 flex-col bg-gray-50">
		<!-- Chat header -->
		<div class="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
			<button
				onclick={() => (historyOpen = !historyOpen)}
				class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden"
				aria-label="Toggle history"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
					/>
				</svg>
			</button>
			<div>
				<h1 class="text-lg font-semibold text-gray-900">RAG Knowledge Chat</h1>
				<p class="text-xs text-gray-500">
					{#if isStreaming}
						AI is responding...
					{:else}
						Powered by Gemini + pgvector
					{/if}
				</p>
			</div>
		</div>

		<!-- Messages -->
		<div bind:this={chatContainer} class="chat-scroll flex-1 overflow-y-auto px-4 py-6" aria-live="polite" aria-relevant="additions">
			{#if activePath.length === 0 && !isStreaming}
				<!-- Empty state -->
				<div class="flex h-full flex-col items-center justify-center text-center">
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600"
					>
						<svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
							/>
						</svg>
					</div>
					<h2 class="mb-2 text-xl font-semibold text-gray-900">Start a conversation</h2>
					<p class="max-w-sm text-sm text-gray-500">
						Ask questions about your uploaded documents. The AI will search your knowledge base and
						provide answers with citations.
					</p>
				</div>
			{/if}

			<div class="mx-auto max-w-3xl space-y-6">
				{#each activePath as message, i (message.id)}
					{@const siblingInfo = getSiblingIndex(message.id)}
					{@const hasBranches = siblingInfo.total > 1}

					<div class="group {message.role === 'user' ? 'flex justify-end' : ''}">
						<div
							class="max-w-[85%] {message.role === 'user'
								? 'rounded-2xl rounded-tr-md bg-indigo-600 px-4 py-3 text-white'
								: 'rounded-2xl rounded-tl-md bg-white px-5 py-4 shadow-sm ring-1 ring-gray-100'}"
						>
							<!-- Role label + timestamp -->
							<div
								class="mb-2 flex items-center gap-2 text-xs {message.role === 'user'
									? 'text-indigo-200'
									: 'text-gray-400'}"
							>
								<span class="font-semibold uppercase tracking-wider">
									{message.role === 'user' ? 'You' : 'AI'}
								</span>
								<span>{formatTime(message.createdAt)}</span>

								<!-- Branch navigation -->
								{#if hasBranches}
									<div class="ml-auto flex items-center gap-1">
										<button
											onclick={() => switchBranch(message.id, -1)}
											disabled={siblingInfo.index === 0}
											class="rounded p-0.5 hover:bg-black/10 disabled:opacity-30"
											aria-label="Previous branch"
										>
											<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
											</svg>
										</button>
										<span class="text-[10px] font-medium tabular-nums">{siblingInfo.index + 1}/{siblingInfo.total}</span>
										<button
											onclick={() => switchBranch(message.id, 1)}
											disabled={siblingInfo.index === siblingInfo.total - 1}
											class="rounded p-0.5 hover:bg-black/10 disabled:opacity-30"
											aria-label="Next branch"
										>
											<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
											</svg>
										</button>
									</div>
								{/if}
							</div>

							<!-- Edit mode -->
							{#if editingId === message.id}
								<div class="space-y-2">
									<textarea
										bind:value={editText}
										class="w-full rounded-lg border bg-white p-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
										rows="3"
									></textarea>
									<div class="flex gap-2">
										<button
											onclick={() => editMessage(message.id, editText)}
											class="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
										>
											Save & Submit
										</button>
										<button
											onclick={cancelEdit}
											class="rounded-lg bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300"
										>
											Cancel
										</button>
									</div>
								</div>
							{:else}
								<!-- Message content -->
								<div
									class="prose prose-sm max-w-none {message.role === 'user'
										? 'prose-invert'
										: 'prose-gray'}"
								>
									{@html renderMarkdown(message.content)}
								</div>
							{/if}

							<!-- Action buttons -->
							{#if editingId !== message.id}
								<div
									class="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 {message.role ===
									'user'
										? 'justify-end'
										: ''}"
								>
									<!-- Copy -->
									<button
										onclick={() => copyToClipboard(message.content)}
										class="rounded p-1 {message.role === 'user'
											? 'text-indigo-200 hover:bg-indigo-500'
											: 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}"
										aria-label="Copy to clipboard"
										title="Copy"
									>
										<svg
											class="h-3.5 w-3.5"
											fill="none"
											viewBox="0 0 24 24"
											stroke-width="1.5"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.75a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184"
											/>
										</svg>
									</button>

									<!-- Edit (user only) -->
									{#if message.role === 'user'}
										<button
											onclick={() => startEdit(message.id)}
											class="rounded p-1 text-indigo-200 hover:bg-indigo-500"
											aria-label="Edit message"
											title="Edit"
										>
											<svg
												class="h-3.5 w-3.5"
												fill="none"
												viewBox="0 0 24 24"
												stroke-width="1.5"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
												/>
											</svg>
										</button>
									{/if}

									<!-- Regenerate (assistant only) -->
									{#if message.role === 'assistant'}
										<button
											onclick={() => regenerateMessage(message.id)}
											disabled={isStreaming}
											class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
											aria-label="Regenerate response"
											title="Regenerate"
										>
											<svg
												class="h-3.5 w-3.5"
												fill="none"
												viewBox="0 0 24 24"
												stroke-width="1.5"
												stroke="currentColor"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
												/>
											</svg>
										</button>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				{/each}

				<!-- Streaming message -->
				{#if isStreaming && streamingText}
					<div class="group">
						<div class="max-w-[85%] rounded-2xl rounded-tl-md bg-white px-5 py-4 shadow-sm ring-1 ring-gray-100">
							<div class="mb-2 flex items-center gap-2 text-xs text-gray-400">
								<span class="font-semibold uppercase tracking-wider">AI</span>
								<span class="flex items-center gap-1">
									<span class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500"></span>
									Streaming
								</span>
							</div>
							<div class="prose prose-sm prose-gray streaming-cursor max-w-none">
								{@html renderMarkdown(streamingText)}
							</div>
						</div>
					</div>
				{/if}

				<!-- Loading indicator (before first chunk) -->
				{#if isStreaming && !streamingText}
					<div class="flex items-center gap-3 px-1">
						<div class="flex gap-1">
							<span class="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style="animation-delay: 0ms"></span>
							<span class="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style="animation-delay: 150ms"></span>
							<span class="h-2 w-2 animate-bounce rounded-full bg-indigo-400" style="animation-delay: 300ms"></span>
						</div>
						<span class="text-sm text-gray-400">Thinking...</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Error display -->
		{#if error}
			<div role="alert" class="mx-4 mb-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
				{error}
				<button onclick={() => (error = null)} class="ml-2 font-medium underline">Dismiss</button>
			</div>
		{/if}

		<!-- Input area -->
		<div class="border-t border-gray-200 bg-white p-4">
			<form
				onsubmit={(e) => {
					e.preventDefault();
					sendMessage(inputValue);
				}}
				class="mx-auto flex max-w-3xl gap-3"
			>
				<div class="relative flex-1">
					<textarea
						bind:value={inputValue}
						onkeydown={handleKeydown}
						placeholder="Ask a question about your documents..."
						rows="1"
						disabled={isStreaming}
						class="w-full resize-none rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 pr-12 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
						aria-label="Message input"
					></textarea>
				</div>
				<button
					type="submit"
					disabled={isStreaming || !inputValue.trim()}
					class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm transition-all hover:bg-indigo-700 disabled:opacity-40"
					aria-label="Send message"
				>
					{#if isStreaming}
						<svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
							<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25"></circle>
							<path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" class="opacity-75"></path>
						</svg>
					{:else}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
						</svg>
					{/if}
				</button>
			</form>
			<p class="mx-auto mt-2 max-w-3xl text-center text-[11px] text-gray-400">
				Press Enter to send, Shift+Enter for new line
			</p>
		</div>
	</div>
</div>
