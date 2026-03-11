import { pgTable, text, timestamp, primaryKey, integer, vector, index, jsonb } from 'drizzle-orm/pg-core';
import type { AdapterAccountType } from '@auth/core/adapters';
import { relations } from 'drizzle-orm';

// ==========================================
// ASSIGNMENT 2: AUTHENTICATION & USERS
// ==========================================

export const users = pgTable('user', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name'),
    email: text('email').unique(),
    emailVerified: timestamp('emailVerified', { mode: 'date' }),
    image: text('image'),
    password: text('password'), // Required for email+password login
    role: text('role').default('user') // Required for RBAC (Admin/User)
});

export const accounts = pgTable('account', {
        userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
        type: text('type').$type<AdapterAccountType>().notNull(),
        provider: text('provider').notNull(),
        providerAccountId: text('providerAccountId').notNull(),
        refresh_token: text('refresh_token'),
        access_token: text('access_token'),
        expires_at: integer('expires_at'),
        token_type: text('token_type'),
        scope: text('scope'),
        id_token: text('id_token'),
        session_state: text('session_state')
    },
    (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })]
);

export const sessions = pgTable('session', {
    sessionToken: text('sessionToken').primaryKey(),
    userId: text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { mode: 'date' }).notNull()
});

export const verificationTokens = pgTable('verificationToken', {
        identifier: text('identifier').notNull(),
        token: text('token').notNull(),
        expires: timestamp('expires', { mode: 'date' }).notNull()
    },
    (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ==========================================
// ASSIGNMENT 3: RAG VECTOR TABLES
// ==========================================

export const documents = pgTable('documents', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    filename: text('filename').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const documentChunks = pgTable('document_chunks', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id').references(() => documents.id, { onDelete: 'cascade' }).notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: 768 }).notNull(),
    metadata: jsonb('metadata'),
}, (table) => [
    index('embeddingIndex').using('hnsw', table.embedding.op('vector_cosine_ops'))
]);

export const documentsRelations = relations(documents, ({ many }) => ({
    chunks: many(documentChunks),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
    document: one(documents, { fields: [documentChunks.documentId], references: [documents.id] }),
}));

// ==========================================
// ASSIGNMENT 3: CHAT HISTORY & TREE STRUCTURE
// ==========================================

export const chats = pgTable('chats', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    title: text('title').notNull().default('New Chat'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const messages = pgTable('messages', {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    chatId: text('chat_id').references(() => chats.id, { onDelete: 'cascade' }).notNull(),
    parentId: text('parent_id'), 
    role: text('role').notNull(), // 'user' or 'assistant'
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const chatsRelations = relations(chats, ({ many, one }) => ({
    messages: many(messages),
    user: one(users, { fields: [chats.userId], references: [users.id] })
}));

export const messagesRelations = relations(messages, ({ one }) => ({
    chat: one(chats, { fields: [messages.chatId], references: [chats.id] }),
    // Self-referencing relation for the tree branching
    parent: one(messages, { fields: [messages.parentId], references: [messages.id] })
}));