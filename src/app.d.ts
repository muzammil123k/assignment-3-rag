// See https://svelte.dev/docs/kit/types#app.d.ts
import type { DefaultSession } from '@auth/core/types';

declare module '@auth/core/types' {
	interface User {
		role?: string;
	}
}

declare module '@auth/sveltekit' {
	interface Session extends DefaultSession {
		user: DefaultSession['user'] & {
			id: string;
			role?: string;
		};
	}
}

declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
