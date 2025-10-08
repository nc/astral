import { DurableObject } from "cloudflare:workers";
import type {
	ChatMessage,
	Chat,
	SpaceData,
	WebSocketMessage,
	WebSocketResponse,
} from "../../shared-types";
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { Agent, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import * as cheerio from 'cheerio';

/**
 * Space Durable Object
 * Manages a space containing multiple chats, each with their own messages
 * Uses SQLite for persistent storage
 *
 * Data hierarchy: Space → Chats → Messages
 */

export class SpaceDurableObject extends DurableObject<Env> {
	private spaceId: string;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.spaceId = ctx.id.toString();
		this.initializeDatabase();
		this.migrateDatabase();
	}

	/**
	 * Handle WebSocket connections and internal HTTP requests
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const upgradeHeader = request.headers.get("Upgrade");

		// Handle internal HTTP request for shared chat lookup
		if (url.pathname.startsWith("/shared/")) {
			const shareId = url.pathname.split("/")[2];
			const sharedChat = await this.getSharedChat(shareId);

			if (sharedChat) {
				return new Response(JSON.stringify(sharedChat), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			} else {
				return new Response(JSON.stringify({ error: "Not found" }), {
					status: 404,
					headers: { "Content-Type": "application/json" },
				});
			}
		}

		// Only accept WebSocket connections
		if (upgradeHeader === "websocket") {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			this.ctx.acceptWebSocket(server);

			return new Response(null, {
				status: 101,
				webSocket: client,
			});
		}

		return new Response("Expected WebSocket connection", { status: 400 });
	}

	/**
	 * Initialize SQLite database with required tables
	 */
	private initializeDatabase(): void {
		// Create spaces table
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS spaces (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				metadata TEXT
			)
		`);

		// Create chats table (without position initially for backwards compatibility)
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS chats (
				id TEXT PRIMARY KEY,
				space_id TEXT NOT NULL,
				name TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL,
				metadata TEXT,
				FOREIGN KEY (space_id) REFERENCES spaces(id)
			)
		`);

		// Create messages table
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS messages (
				id TEXT PRIMARY KEY,
				chat_id TEXT NOT NULL,
				content TEXT NOT NULL,
				role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
				timestamp INTEGER NOT NULL,
				metadata TEXT,
				FOREIGN KEY (chat_id) REFERENCES chats(id)
			)
		`);

		// Create index on space_id for faster chat queries
		this.ctx.storage.sql.exec(`
			CREATE INDEX IF NOT EXISTS idx_chats_space_id ON chats(space_id)
		`);

		// Create index on chat_id for faster message queries
		this.ctx.storage.sql.exec(`
			CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)
		`);

		// Create index on timestamp for chronological ordering
		this.ctx.storage.sql.exec(`
			CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)
		`);
	}

	/**
	 * Database migrations - run after initialization
	 */
	private migrateDatabase(): void {
		// Migration: Add position column to chats table if it doesn't exist
		try {
			// Check if position column exists
			const cursor = this.ctx.storage.sql.exec(`PRAGMA table_info(chats)`);
			const columns = [...cursor];
			const hasPosition = columns.some((col: any) => col.name === 'position');

			if (!hasPosition) {
				console.log('Running migration: Adding position column to chats table');

				// Add position column with default value 0
				this.ctx.storage.sql.exec(`ALTER TABLE chats ADD COLUMN position REAL NOT NULL DEFAULT 0`);

				// Set position based on created_at order for existing chats
				this.ctx.storage.sql.exec(`
					UPDATE chats SET position = (
						SELECT COUNT(*) FROM chats c2
						WHERE c2.space_id = chats.space_id
						AND c2.created_at < chats.created_at
					)
				`);

				// Create index on position
				this.ctx.storage.sql.exec(`
					CREATE INDEX IF NOT EXISTS idx_chats_position ON chats(space_id, position)
				`);

				console.log('Migration completed: position column added');
			}
		} catch (error) {
			console.error('Migration failed:', error);
		}

		// Migration: Add model column to chats table if it doesn't exist
		try {
			const cursor = this.ctx.storage.sql.exec(`PRAGMA table_info(chats)`);
			const columns = [...cursor];
			const hasModel = columns.some((col: any) => col.name === 'model');

			if (!hasModel) {
				console.log('Running migration: Adding model column to chats table');

				// Add model column
				this.ctx.storage.sql.exec(`ALTER TABLE chats ADD COLUMN model TEXT`);

				console.log('Migration completed: model column added');
			}
		} catch (error) {
			console.error('Migration failed:', error);
		}

		// Migration: Create shared_chats table for publicly shared chats
		try {
			const cursor = this.ctx.storage.sql.exec(`
				SELECT name FROM sqlite_master WHERE type='table' AND name='shared_chats'
			`);
			const tables = [...cursor];

			if (tables.length === 0) {
				console.log('Running migration: Creating shared_chats table');

				this.ctx.storage.sql.exec(`
					CREATE TABLE shared_chats (
						share_id TEXT PRIMARY KEY,
						space_id TEXT NOT NULL,
						chat_id TEXT NOT NULL,
						chat_name TEXT NOT NULL,
						model TEXT,
						created_at INTEGER NOT NULL,
						FOREIGN KEY (chat_id) REFERENCES chats(id)
					)
				`);

				console.log('Migration completed: shared_chats table created');
			} else {
				// Migration: Add space_id column to existing shared_chats table
				const columnsCursor = this.ctx.storage.sql.exec(`PRAGMA table_info(shared_chats)`);
				const columns = [...columnsCursor];
				const hasSpaceId = columns.some((col: any) => col.name === 'space_id');

				if (!hasSpaceId) {
					console.log('Running migration: Adding space_id column to shared_chats table');

					// Add space_id column with a default value (current space ID)
					this.ctx.storage.sql.exec(`ALTER TABLE shared_chats ADD COLUMN space_id TEXT NOT NULL DEFAULT '${this.spaceId}'`);

					console.log('Migration completed: space_id column added to shared_chats');
				}
			}
		} catch (error) {
			console.error('Migration failed:', error);
		}

		// Migration: Add tool_calls and tool_results columns to messages table
		try {
			const cursor = this.ctx.storage.sql.exec(`PRAGMA table_info(messages)`);
			const columns = [...cursor];
			const hasToolCalls = columns.some((col: any) => col.name === 'tool_calls');
			const hasToolResults = columns.some((col: any) => col.name === 'tool_results');

			if (!hasToolCalls) {
				console.log('Running migration: Adding tool_calls column to messages table');
				this.ctx.storage.sql.exec(`ALTER TABLE messages ADD COLUMN tool_calls TEXT`);
				console.log('Migration completed: tool_calls column added');
			}

			if (!hasToolResults) {
				console.log('Running migration: Adding tool_results column to messages table');
				this.ctx.storage.sql.exec(`ALTER TABLE messages ADD COLUMN tool_results TEXT`);
				console.log('Migration completed: tool_results column added');
			}
		} catch (error) {
			console.error('Migration failed:', error);
		}
	}

	/**
	 * Initialize or get space data
	 */
	async getOrCreateSpace(name?: string): Promise<SpaceData> {
		const cursor = this.ctx.storage.sql.exec(
			`SELECT * FROM spaces WHERE id = ?`,
			this.spaceId
		);

		const rows = [...cursor];
		if (rows.length > 0) {
			const row = rows[0];
			return {
				id: row.id as string,
				name: row.name as string,
				createdAt: row.created_at as number,
				updatedAt: row.updated_at as number,
				metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
			};
		}

		// Create new space
		const now = Date.now();
		const spaceName = name || `Space ${this.spaceId.slice(0, 8)}`;

		this.ctx.storage.sql.exec(
			`INSERT INTO spaces (id, name, created_at, updated_at, metadata) VALUES (?, ?, ?, ?, ?)`,
			this.spaceId,
			spaceName,
			now,
			now,
			null
		);

		return {
			id: this.spaceId,
			name: spaceName,
			createdAt: now,
			updatedAt: now,
		};
	}

	/**
	 * Update space metadata
	 */
	async updateSpaceMetadata(metadata: Record<string, any>): Promise<void> {
		const now = Date.now();

		// If metadata contains a name, update the name field as well
		if (metadata.name !== undefined) {
			this.ctx.storage.sql.exec(
				`UPDATE spaces SET name = ?, metadata = ?, updated_at = ? WHERE id = ?`,
				metadata.name,
				JSON.stringify(metadata),
				now,
				this.spaceId
			);
		} else {
			this.ctx.storage.sql.exec(
				`UPDATE spaces SET metadata = ?, updated_at = ? WHERE id = ?`,
				JSON.stringify(metadata),
				now,
				this.spaceId
			);
		}
	}

	// ============== Chat Methods ==============

	/**
	 * Create a new chat in this space
	 * Position parameter allows inserting at specific position (for branching)
	 */
	async createChat(name?: string, metadata?: Record<string, any>, position?: number, model?: string): Promise<Chat> {
		const chatId = crypto.randomUUID();
		const now = Date.now();
		const chatName = name || `Chat ${chatId.slice(0, 8)}`;

		// If no position specified, append to end (get max position + 1)
		let chatPosition = position;
		if (chatPosition === undefined) {
			const cursor = this.ctx.storage.sql.exec(
				`SELECT COALESCE(MAX(position), -1) as max_pos FROM chats WHERE space_id = ?`,
				this.spaceId
			);
			const rows = [...cursor];
			const maxPos = rows.length > 0 ? (rows[0].max_pos as number) : -1;
			chatPosition = maxPos + 1;
		} else {
			// Shift positions of chats at or after this position
			this.ctx.storage.sql.exec(
				`UPDATE chats SET position = position + 1 WHERE space_id = ? AND position >= ?`,
				this.spaceId,
				chatPosition
			);
		}

		this.ctx.storage.sql.exec(
			`INSERT INTO chats (id, space_id, name, created_at, updated_at, position, metadata, model) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			chatId,
			this.spaceId,
			chatName,
			now,
			now,
			chatPosition,
			metadata ? JSON.stringify(metadata) : null,
			model || null
		);

		// Update space's updated_at timestamp
		this.ctx.storage.sql.exec(
			`UPDATE spaces SET updated_at = ? WHERE id = ?`,
			now,
			this.spaceId
		);

		return {
			id: chatId,
			spaceId: this.spaceId,
			name: chatName,
			createdAt: now,
			updatedAt: now,
			position: chatPosition,
			metadata,
			model,
		};
	}

	/**
	 * Get all chats in this space
	 */
	async getChats(limit?: number, offset?: number): Promise<Chat[]> {
		const query = limit !== undefined
			? `SELECT * FROM chats WHERE space_id = ? ORDER BY position ASC LIMIT ? OFFSET ?`
			: `SELECT * FROM chats WHERE space_id = ? ORDER BY position ASC`;

		const params = limit !== undefined
			? [this.spaceId, limit, offset || 0]
			: [this.spaceId];

		const cursor = this.ctx.storage.sql.exec(query, ...params);
		const chats: Chat[] = [];

		for (const row of cursor) {
			chats.push({
				id: row.id as string,
				spaceId: row.space_id as string,
				name: row.name as string,
				createdAt: row.created_at as number,
				updatedAt: row.updated_at as number,
				position: row.position as number,
				metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
				model: row.model as string | undefined,
			});
		}

		return chats;
	}

	/**
	 * Get a specific chat by ID
	 */
	async getChat(chatId: string): Promise<Chat | null> {
		const cursor = this.ctx.storage.sql.exec(
			`SELECT * FROM chats WHERE id = ? AND space_id = ?`,
			chatId,
			this.spaceId
		);

		const rows = [...cursor];
		if (rows.length === 0) return null;

		const row = rows[0];
		return {
			id: row.id as string,
			spaceId: row.space_id as string,
			name: row.name as string,
			createdAt: row.created_at as number,
			updatedAt: row.updated_at as number,
			position: row.position as number,
			metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
			model: row.model as string | undefined,
		};
	}

	/**
	 * Update chat metadata
	 */
	async updateChatMetadata(chatId: string, metadata: Record<string, any>): Promise<boolean> {
		const result = this.ctx.storage.sql.exec(
			`UPDATE chats SET metadata = ?, updated_at = ? WHERE id = ? AND space_id = ?`,
			JSON.stringify(metadata),
			Date.now(),
			chatId,
			this.spaceId
		);

		return result.rowsWritten > 0;
	}

	/**
	 * Update chat position (for reordering)
	 */
	async updateChatPosition(chatId: string, newPosition: number): Promise<boolean> {
		// Get current position
		const chatCursor = this.ctx.storage.sql.exec(
			`SELECT position FROM chats WHERE id = ? AND space_id = ?`,
			chatId,
			this.spaceId
		);
		const chatRows = [...chatCursor];
		if (chatRows.length === 0) return false;

		const oldPosition = chatRows[0].position as number;

		if (oldPosition === newPosition) return true;

		// Shift positions
		if (newPosition < oldPosition) {
			// Moving left: shift items right between new and old position
			this.ctx.storage.sql.exec(
				`UPDATE chats SET position = position + 1 WHERE space_id = ? AND position >= ? AND position < ?`,
				this.spaceId,
				newPosition,
				oldPosition
			);
		} else {
			// Moving right: shift items left between old and new position
			this.ctx.storage.sql.exec(
				`UPDATE chats SET position = position - 1 WHERE space_id = ? AND position > ? AND position <= ?`,
				this.spaceId,
				oldPosition,
				newPosition
			);
		}

		// Update the chat's position
		const result = this.ctx.storage.sql.exec(
			`UPDATE chats SET position = ? WHERE id = ? AND space_id = ?`,
			newPosition,
			chatId,
			this.spaceId
		);

		return result.rowsWritten > 0;
	}

	/**
	 * Delete a chat and all its messages
	 */
	async deleteChat(chatId: string): Promise<boolean> {
		// Delete all messages in the chat
		this.ctx.storage.sql.exec(
			`DELETE FROM messages WHERE chat_id = ?`,
			chatId
		);

		// Delete the chat
		const result = this.ctx.storage.sql.exec(
			`DELETE FROM chats WHERE id = ? AND space_id = ?`,
			chatId,
			this.spaceId
		);

		// Update space's updated_at timestamp
		if (result.rowsWritten > 0) {
			this.ctx.storage.sql.exec(
				`UPDATE spaces SET updated_at = ? WHERE id = ?`,
				Date.now(),
				this.spaceId
			);
		}

		return result.rowsWritten > 0;
	}

	/**
	 * Get chat count for this space
	 */
	async getChatCount(): Promise<number> {
		const cursor = this.ctx.storage.sql.exec(
			`SELECT COUNT(*) as count FROM chats WHERE space_id = ?`,
			this.spaceId
		);

		const rows = [...cursor];
		return rows.length > 0 ? (rows[0].count as number) : 0;
	}

	/**
	 * Share a chat - creates a public snapshot of the chat
	 */
	async shareChat(chatId: string): Promise<{ shareId: string; spaceId: string }> {
		// Verify chat exists in this space
		const chat = await this.getChat(chatId);
		if (!chat) {
			throw new Error("Chat not found");
		}

		// Generate a unique share ID
		const shareId = crypto.randomUUID();

		// Create shared chat entry
		this.ctx.storage.sql.exec(
			`INSERT INTO shared_chats (share_id, space_id, chat_id, chat_name, model, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
			shareId,
			this.spaceId,
			chatId,
			chat.name,
			chat.model || null,
			Date.now()
		);

		return { shareId, spaceId: this.spaceId };
	}

	/**
	 * Get shared chat data by share ID
	 */
	async getSharedChat(shareId: string): Promise<any | null> {
		// Check if this share ID exists in this space
		const cursor = this.ctx.storage.sql.exec(
			`SELECT share_id, space_id, chat_id, chat_name, model, created_at
			 FROM shared_chats
			 WHERE share_id = ? AND space_id = ?`,
			shareId,
			this.spaceId
		);

		const rows = [...cursor];
		if (rows.length === 0) {
			return null;
		}

		const shareRow = rows[0];

		// Get all messages for this chat
		const messages = await this.getMessages(shareRow.chat_id as string);

		return {
			chatName: shareRow.chat_name,
			model: shareRow.model,
			messages,
			createdAt: shareRow.created_at,
		};
	}

	// ============== Message Methods ==============

	/**
	 * Add a message to a chat
	 */
	async addMessage(
		chatId: string,
		content: string,
		role: "user" | "assistant" | "system",
		metadata?: Record<string, any>,
		toolCall?: {toolName: string; args: Record<string, any>},
		toolResult?: {toolName: string; result: any}
	): Promise<ChatMessage> {
		const messageId = crypto.randomUUID();
		const timestamp = Date.now();

		this.ctx.storage.sql.exec(
			`INSERT INTO messages (id, chat_id, content, role, timestamp, metadata, tool_calls, tool_results) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			messageId,
			chatId,
			content,
			role,
			timestamp,
			metadata ? JSON.stringify(metadata) : null,
			toolCall ? JSON.stringify(toolCall) : null,
			toolResult ? JSON.stringify(toolResult) : null
		);

		// Update chat's updated_at timestamp
		this.ctx.storage.sql.exec(
			`UPDATE chats SET updated_at = ? WHERE id = ?`,
			timestamp,
			chatId
		);

		return {
			id: messageId,
			chatId,
			content,
			role,
			timestamp,
			metadata,
			toolCall,
			toolResult,
		};
	}

	/**
	 * Get all messages for a chat
	 */
	async getMessages(chatId: string, limit?: number, offset?: number): Promise<ChatMessage[]> {
		const query = limit !== undefined
			? `SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC LIMIT ? OFFSET ?`
			: `SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC`;

		const params = limit !== undefined
			? [chatId, limit, offset || 0]
			: [chatId];

		const cursor = this.ctx.storage.sql.exec(query, ...params);
		const messages: ChatMessage[] = [];

		for (const row of cursor) {
			const toolCall = row.tool_calls ? JSON.parse(row.tool_calls as string) : undefined;
			const toolResult = row.tool_results ? JSON.parse(row.tool_results as string) : undefined;

			console.log('📖 [BACKEND] Loading message:', row.id, 'toolCall:', toolCall, 'toolResult:', toolResult);

			messages.push({
				id: row.id as string,
				chatId: row.chat_id as string,
				content: row.content as string,
				role: row.role as "user" | "assistant" | "system",
				timestamp: row.timestamp as number,
				metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
				toolCall,
				toolResult,
			});
		}

		return messages;
	}

	/**
	 * Get a specific message by ID
	 */
	async getMessage(messageId: string): Promise<ChatMessage | null> {
		const cursor = this.ctx.storage.sql.exec(
			`SELECT m.* FROM messages m
			 JOIN chats c ON m.chat_id = c.id
			 WHERE m.id = ? AND c.space_id = ?`,
			messageId,
			this.spaceId
		);

		const rows = [...cursor];
		if (rows.length === 0) return null;

		const row = rows[0];
		return {
			id: row.id as string,
			chatId: row.chat_id as string,
			content: row.content as string,
			role: row.role as "user" | "assistant" | "system",
			timestamp: row.timestamp as number,
			metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
			toolCall: row.tool_calls ? JSON.parse(row.tool_calls as string) : undefined,
			toolResult: row.tool_results ? JSON.parse(row.tool_results as string) : undefined,
		};
	}

	/**
	 * Delete a message by ID
	 */
	async deleteMessage(messageId: string): Promise<boolean> {
		const result = this.ctx.storage.sql.exec(
			`DELETE FROM messages WHERE id = ? AND chat_id IN (SELECT id FROM chats WHERE space_id = ?)`,
			messageId,
			this.spaceId
		);

		return result.rowsWritten > 0;
	}

	/**
	 * Get message count for a chat
	 */
	async getMessageCount(chatId: string): Promise<number> {
		const cursor = this.ctx.storage.sql.exec(
			`SELECT COUNT(*) as count FROM messages WHERE chat_id = ?`,
			chatId
		);

		const rows = [...cursor];
		return rows.length > 0 ? (rows[0].count as number) : 0;
	}

	/**
	 * Clear all messages in a chat
	 */
	async clearMessages(chatId: string): Promise<number> {
		const result = this.ctx.storage.sql.exec(
			`DELETE FROM messages WHERE chat_id = ?`,
			chatId
		);

		// Update chat's updated_at timestamp
		this.ctx.storage.sql.exec(
			`UPDATE chats SET updated_at = ? WHERE id = ?`,
			Date.now(),
			chatId
		);

		return result.rowsWritten;
	}

	// ============== WebSocket Handlers ==============

	/**
	 * Handle incoming WebSocket messages
	 */
	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
		try {
			const data = typeof message === "string" ? message : new TextDecoder().decode(message);
			const request: WebSocketMessage = JSON.parse(data);

			// Special handling for streaming chat method
			if (request.method === "streamChat") {
				await this.handleStreamChat(ws, request);
				return;
			}

			let response: WebSocketResponse;

			try {
				const result = await this.handleWebSocketMethod(request.method, request.params);
				response = {
					id: request.id,
					result,
				};
			} catch (error) {
				response = {
					id: request.id,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}

			ws.send(JSON.stringify(response));
		} catch (error) {
			ws.send(
				JSON.stringify({
					error: "Invalid message format",
				})
			);
		}
	}

	/**
	 * Handle streaming chat over WebSocket
	 */
	private async handleStreamChat(ws: WebSocket, request: WebSocketMessage) {
		try {
			const { messages, model, chatId } = request.params;

			if (!messages || !Array.isArray(messages) || messages.length === 0) {
				ws.send(JSON.stringify({
					id: request.id,
					error: 'Messages array is required',
				}));
				return;
			}

			if (!model) {
				ws.send(JSON.stringify({
					id: request.id,
					error: 'Model is required',
				}));
				return;
			}

			// Get API keys from environment
			const anthropicKey = this.env.ANTHROPIC_API_KEY;
			const openaiKey = this.env.OPENAI_API_KEY;
			const serperKey = this.env.SERPER_API_KEY;

			if (!anthropicKey && model.startsWith('claude-')) {
				ws.send(JSON.stringify({
					id: request.id,
					error: 'ANTHROPIC_API_KEY not configured',
				}));
				return;
			}

			if (!openaiKey && (model.startsWith('gpt-') || model.startsWith('o1-') || model.startsWith('o3-'))) {
				ws.send(JSON.stringify({
					id: request.id,
					error: 'OPENAI_API_KEY not configured',
				}));
				return;
			}

			// Initialize AI providers
			const anthropic = createAnthropic({ apiKey: anthropicKey });
			const openai = createOpenAI({ apiKey: openaiKey });

			// Determine model provider
			let modelProvider;
			if (model.startsWith('claude-')) {
				modelProvider = anthropic(model);
			} else if (model.startsWith('gpt-') || model.startsWith('o1-') || model.startsWith('o3-')) {
				modelProvider = openai(model);
			} else {
				ws.send(JSON.stringify({
					id: request.id,
					error: 'Unsupported model',
				}));
				return;
			}

			// Create web search tool
			const webSearchTool = tool({
				description: 'Search the web for current information, news, and answers to questions',
				inputSchema: z.object({
					query: z.string().describe('The search query to execute'),
					num: z.number().optional().default(10).describe('Number of search results to return (default: 10)'),
				}),
				execute: async ({ query, num = 10 }) => {
					if (!serperKey) {
						throw new Error('SERPER_API_KEY not configured');
					}

					const response = await fetch('https://google.serper.dev/search', {
						method: 'POST',
						headers: {
							'X-API-KEY': serperKey,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ q: query, num }),
					});

					if (!response.ok) {
						throw new Error(`Search API error: ${response.status}`);
					}

					const data = await response.json() as any;

					return {
						searchTerm: query,
						results: data.organic?.map((result: any, index: number) => ({
							position: index + 1,
							title: result.title,
							link: result.link,
							snippet: result.snippet,
						})) || [],
						answerBox: data.answerBox || null,
						peopleAlsoAsk: data.peopleAlsoAsk?.slice(0, 3) || [],
						relatedSearches: data.relatedSearches?.slice(0, 5) || [],
					};
				},
			});

			// Create visit webpage tool
			const visitWebpageTool = tool({
				description: 'Visit a webpage and retrieve its content, including text, headings, links, and metadata',
				inputSchema: z.object({
					url: z.string().url().describe('The URL of the webpage to visit'),
					maxLength: z.number().optional().default(10000).describe('Maximum content length to extract (default: 10000 characters)'),
				}),
				execute: async ({ url, maxLength = 10000 }) => {
					const response = await fetch(url, {
						headers: {
							'User-Agent': 'Mozilla/5.0 (compatible; WebpageVisitor/1.0)',
							'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
						},
					});

					if (!response.ok) {
						throw new Error(`HTTP ${response.status}: ${response.statusText}`);
					}

					const html = await response.text();
					const $ = cheerio.load(html);

					const title = $('title').text().trim() || $('h1').first().text().trim() || 'No title found';
					const description = $('meta[name="description"]').attr('content') || undefined;

					// Extract headings
					const headings = {
						h1: $('h1').map((_, el) => $(el).text().trim()).get(),
						h2: $('h2').map((_, el) => $(el).text().trim()).get(),
						h3: $('h3').map((_, el) => $(el).text().trim()).get(),
					};

					// Extract main content
					$('script, style, nav, header, footer, aside').remove();
					let contentElement = $('main, article, .content, #content').first();
					if (contentElement.length === 0) {
						contentElement = $('body');
					}

					const rawContent = contentElement.text()
						.replace(/\s+/g, ' ')
						.trim();

					const content = rawContent.length > maxLength
						? rawContent.substring(0, maxLength) + '...'
						: rawContent;

					return {
						url,
						title,
						content,
						description,
						headings,
						wordCount: content.split(/\s+/).length,
					};
				},
			});

			// Create agent
			const agent = new Agent({
				model: modelProvider,
				system: 'You are a helpful AI assistant with access to web search and webpage content retrieval.',
				tools: {
					webSearch: webSearchTool,
					visitWebpage: visitWebpageTool,
				},
				stopWhen: stepCountIs(10),
			});

			// Send start message
			ws.send(JSON.stringify({
				id: request.id,
				type: 'start',
			}));

			// Stream response
			try {
				const stream = agent.stream({ messages });
				let lastChunkTime = Date.now();
				let keepAliveInterval: NodeJS.Timeout | null = null;
				let currentMessageStarted = false;

				// Set up keep-alive to prevent WebSocket timeout during slow streaming
				keepAliveInterval = setInterval(() => {
					// Only send keep-alive if we haven't received a chunk in the last 5 seconds
					if (Date.now() - lastChunkTime > 5000) {
						ws.send(JSON.stringify({
							id: request.id,
							type: 'keepalive',
						}));
					}
				}, 5000); // Check every 5 seconds

				try {
					// Track current tool call and result (one at a time)
					let currentToolCall: {toolName: string; args: any} | null = null;

					// Listen to full event stream to detect tool calls
					for await (const part of stream.fullStream) {
						lastChunkTime = Date.now();

						if (part.type === 'text-delta') {
							// Start new message if needed
							if (!currentMessageStarted) {
								ws.send(JSON.stringify({
									id: request.id,
									type: 'message-start',
								}));
								currentMessageStarted = true;
							}
							// Stream text chunk
							ws.send(JSON.stringify({
								id: request.id,
								type: 'chunk',
								data: part.text,
							}));
						} else if (part.type === 'tool-call') {
							// End current message before tool call
							if (currentMessageStarted) {
								ws.send(JSON.stringify({
									id: request.id,
									type: 'message-end',
								}));
								currentMessageStarted = false;
							}

							console.log('🔧 [BACKEND] Tool call detected:', part.toolName, 'with input:', part.input);

							// Store current tool call (use 'input' not 'args')
							currentToolCall = {
								toolName: part.toolName,
								args: part.input as any,
							};

							console.log('🔧 [BACKEND] currentToolCall after creation:', JSON.stringify(currentToolCall, null, 2));

							// Send tool call info to client
							ws.send(JSON.stringify({
								id: request.id,
								type: 'tool-call',
								toolName: part.toolName,
								args: part.input,
							}));

							// Create assistant message with tool call immediately
							if (chatId && currentToolCall) {
								console.log('💾 [BACKEND] About to create tool call message with:', currentToolCall);

								const toolCallMsg = await this.addMessage(
									chatId,
									'', // Empty content for tool call messages
									'assistant',
									undefined,
									currentToolCall,
									undefined
								);

								console.log('💾 [BACKEND] Tool call message created:', toolCallMsg.id, 'toolCall in response:', toolCallMsg.toolCall);

								// Send the created message to client
								ws.send(JSON.stringify({
									id: request.id,
									type: 'tool-call-message',
									message: toolCallMsg,
								}));
							}
						} else if (part.type === 'tool-result') {
							console.log('✅ [BACKEND] Tool result received:', part.toolName, 'with output:', part.output);

							// Store tool result (use 'output' not 'result')
							const toolResult = {
								toolName: part.toolName,
								result: part.output,
							};

							console.log('✅ [BACKEND] toolResult after creation:', JSON.stringify(toolResult, null, 2));

							// Send tool result to client
							ws.send(JSON.stringify({
								id: request.id,
								type: 'tool-result',
								toolName: part.toolName,
								result: part.output,
							}));

							// Create user message with tool result immediately
							if (chatId) {
								const toolResultMsg = await this.addMessage(
									chatId,
									'', // Empty content for tool result messages
									'user',
									undefined,
									undefined,
									toolResult
								);

								console.log('💾 [BACKEND] Tool result message created:', toolResultMsg.id);

								// Send the created message to client
								ws.send(JSON.stringify({
									id: request.id,
									type: 'tool-result-message',
									message: toolResultMsg,
								}));
							}

							// Clear current tool call
							currentToolCall = null;
						}
					}

					// End final message if one was started
					if (currentMessageStarted) {
						ws.send(JSON.stringify({
							id: request.id,
							type: 'message-end',
						}));
					}
				} finally {
					// Clear keep-alive interval
					if (keepAliveInterval) {
						clearInterval(keepAliveInterval);
					}
				}

				// Send completion message
				ws.send(JSON.stringify({
					id: request.id,
					type: 'done',
				}));
			} catch (streamError) {
				ws.send(JSON.stringify({
					id: request.id,
					error: streamError instanceof Error ? streamError.message : 'Stream error',
				}));
			}
		} catch (error) {
			ws.send(JSON.stringify({
				id: request.id,
				error: error instanceof Error ? error.message : 'Unknown error',
			}));
		}
	}

	/**
	 * Handle WebSocket close
	 */
	async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
		// Don't try to close with reserved codes (1005, 1006, 1015)
		// Just let the connection close naturally
		console.log(`WebSocket closed: code=${code}, reason=${reason}, wasClean=${wasClean}`);
	}

	/**
	 * Handle WebSocket error
	 */
	async webSocketError(ws: WebSocket, error: unknown) {
		console.error("WebSocket error:", error);
	}

	/**
	 * Route WebSocket methods to appropriate handlers
	 */
	private async handleWebSocketMethod(method: string, params: any): Promise<any> {
		switch (method) {
			// Space methods
			case "getOrCreateSpace":
				return await this.getOrCreateSpace(params?.name);
			case "updateSpaceMetadata":
				await this.updateSpaceMetadata(params.metadata);
				return { success: true };

			// Chat methods
			case "createChat":
				return await this.createChat(params?.name, params?.metadata, params?.position, params?.model);
			case "getChats":
				return await this.getChats(params?.limit, params?.offset);
			case "getChat":
				return await this.getChat(params.chatId);
			case "updateChatMetadata":
				const updated = await this.updateChatMetadata(params.chatId, params.metadata);
				if (!updated) throw new Error("Chat not found");
				return { success: true };
			case "updateChatPosition":
				const positionUpdated = await this.updateChatPosition(params.chatId, params.position);
				if (!positionUpdated) throw new Error("Chat not found");
				return { success: true };
			case "deleteChat":
				const deleted = await this.deleteChat(params.chatId);
				if (!deleted) throw new Error("Chat not found");
				return { success: true };
			case "getChatCount":
				return await this.getChatCount();
			case "shareChat":
				return await this.shareChat(params.chatId);

			// Message methods
			case "addMessage":
				return await this.addMessage(
					params.chatId,
					params.content,
					params.role,
					params?.metadata
				);
			case "getMessages":
				return await this.getMessages(params.chatId, params?.limit, params?.offset);
			case "getMessage":
				const message = await this.getMessage(params.messageId);
				if (!message) throw new Error("Message not found");
				return message;
			case "deleteMessage":
				const messageDeleted = await this.deleteMessage(params.messageId);
				if (!messageDeleted) throw new Error("Message not found");
				return { success: true };
			case "getMessageCount":
				return await this.getMessageCount(params.chatId);
			case "clearMessages":
				const count = await this.clearMessages(params.chatId);
				return { deletedCount: count };

			default:
				throw new Error(`Unknown method: ${method}`);
		}
	}

	/**
	 * Broadcast message to all connected WebSocket clients
	 */
	broadcast(message: any) {
		const data = JSON.stringify(message);
		for (const ws of this.ctx.getWebSockets()) {
			ws.send(data);
		}
	}
}

/** User Durable Object - manages user authentication and data */
export class UserDurableObject extends DurableObject<Env> {
	private userId: string;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.userId = ctx.id.toString();
		this.initializeDatabase();
	}

	private initializeDatabase(): void {
		// Create user profile table
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS user_profile (
				user_id TEXT PRIMARY KEY,
				email TEXT NOT NULL,
				name TEXT,
				picture TEXT,
				created_at INTEGER NOT NULL,
				last_login INTEGER NOT NULL
			)
		`);

		// Create user spaces table (tracks which spaces belong to which user)
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS user_spaces (
				user_id TEXT NOT NULL,
				space_id TEXT NOT NULL,
				created_at INTEGER NOT NULL,
				PRIMARY KEY (user_id, space_id)
			)
		`);
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// Handle OAuth callback
		if (url.pathname === "/oauth/callback") {
			return this.handleOAuthCallback(request);
		}

		// Handle WebSocket for user operations
		const upgradeHeader = request.headers.get("Upgrade");
		if (upgradeHeader === "websocket") {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			this.ctx.acceptWebSocket(server);

			return new Response(null, {
				status: 101,
				webSocket: client,
			});
		}

		return new Response("Expected WebSocket connection or OAuth callback", { status: 400 });
	}

	private async handleOAuthCallback(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const code = url.searchParams.get('code');

		if (!code) {
			return new Response(JSON.stringify({ error: 'No authorization code provided' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		try {
			// Exchange code for tokens
			console.log("Token exchange,", url.origin)
			const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					code,
					client_id: this.env.GCP_OAUTH_CLIENT_ID,
					client_secret: this.env.GCP_OAUTH_CLIENT_SECRET,
					redirect_uri: `${url.origin}/auth/callback`,
					grant_type: 'authorization_code',
				}),
			});

			if (!tokenResponse.ok) {
				throw new Error('Failed to exchange code for tokens');
			}

			const tokens = await tokenResponse.json() as { access_token: string; id_token: string };

			// Get user info
			const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
				headers: { Authorization: `Bearer ${tokens.access_token}` },
			});

			if (!userInfoResponse.ok) {
				throw new Error('Failed to get user info');
			}

			const userInfo = await userInfoResponse.json() as {
				id: string;
				email: string;
				name: string;
				picture: string;
			};

			// Store user profile
			const now = Date.now();
			this.ctx.storage.sql.exec(
				`INSERT OR REPLACE INTO user_profile (user_id, email, name, picture, created_at, last_login)
				 VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM user_profile WHERE user_id = ?), ?), ?)`,
				userInfo.id,
				userInfo.email,
				userInfo.name,
				userInfo.picture,
				userInfo.id,
				now,
				now
			);

			return new Response(JSON.stringify({
				userId: userInfo.id,
				email: userInfo.email,
				name: userInfo.name,
				picture: userInfo.picture,
				accessToken: tokens.access_token,
			}), {
				headers: { 'Content-Type': 'application/json' },
			});
		} catch (error) {
			console.error('OAuth error:', error);
			return new Response(JSON.stringify({
				error: error instanceof Error ? error.message : 'Authentication failed'
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	}

	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
		try {
			const data = typeof message === "string" ? message : new TextDecoder().decode(message);
			const request = JSON.parse(data);

			let response;

			try {
				const result = await this.handleMethod(request.method, request.params);
				response = { id: request.id, result };
			} catch (error) {
				response = {
					id: request.id,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}

			ws.send(JSON.stringify(response));
		} catch (error) {
			ws.send(JSON.stringify({ error: "Invalid message format" }));
		}
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
		console.log(`User WebSocket closed: code=${code}, reason=${reason}, wasClean=${wasClean}`);
	}

	async webSocketError(ws: WebSocket, error: unknown) {
		console.error("User WebSocket error:", error);
	}

	private async handleMethod(method: string, params: any): Promise<any> {
		switch (method) {
			case "getUserProfile":
				return await this.getUserProfile();
			case "getUserSpaces":
				return await this.getUserSpaces();
			case "addUserSpace":
				return await this.addUserSpace(params.spaceId);
			case "removeUserSpace":
				return await this.removeUserSpace(params.spaceId);
			default:
				throw new Error(`Unknown method: ${method}`);
		}
	}

	async getUserProfile() {
		const cursor = this.ctx.storage.sql.exec(
			`SELECT * FROM user_profile WHERE user_id = ?`,
			this.userId
		);

		const rows = [...cursor];
		if (rows.length === 0) return null;

		const row = rows[0];
		return {
			userId: row.user_id as string,
			email: row.email as string,
			name: row.name as string,
			picture: row.picture as string,
			createdAt: row.created_at as number,
			lastLogin: row.last_login as number,
		};
	}

	async getUserSpaces() {
		const cursor = this.ctx.storage.sql.exec(
			`SELECT space_id FROM user_spaces WHERE user_id = ? ORDER BY created_at DESC`,
			this.userId
		);

		const spaceIds = [];
		for (const row of cursor) {
			spaceIds.push(row.space_id as string);
		}

		return spaceIds;
	}

	async addUserSpace(spaceId: string) {
		const now = Date.now();
		this.ctx.storage.sql.exec(
			`INSERT OR IGNORE INTO user_spaces (user_id, space_id, created_at) VALUES (?, ?, ?)`,
			this.userId,
			spaceId,
			now
		);

		return { success: true };
	}

	async removeUserSpace(spaceId: string) {
		this.ctx.storage.sql.exec(
			`DELETE FROM user_spaces WHERE user_id = ? AND space_id = ?`,
			this.userId,
			spaceId
		);

		return { success: true };
	}
}

/** Space Registry Durable Object - tracks all spaces */
export class SpaceRegistryDurableObject extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.initializeDatabase();
		this.migrateDatabase();
	}

	private initializeDatabase(): void {
		this.ctx.storage.sql.exec(`
			CREATE TABLE IF NOT EXISTS space_registry (
				space_id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				created_at INTEGER NOT NULL
			)
		`);
	}

	private migrateDatabase(): void {
		// Migration: Add user_id column to space_registry table if it doesn't exist
		try {
			// Check if user_id column exists
			const cursor = this.ctx.storage.sql.exec(`PRAGMA table_info(space_registry)`);
			const columns = [...cursor];
			const hasUserId = columns.some((col: any) => col.name === 'user_id');

			if (!hasUserId) {
				console.log('Running migration: Adding user_id column to space_registry table');

				// Add user_id column
				this.ctx.storage.sql.exec(`ALTER TABLE space_registry ADD COLUMN user_id TEXT`);

				// Create index on user_id for faster filtering
				this.ctx.storage.sql.exec(`
					CREATE INDEX IF NOT EXISTS idx_space_registry_user_id ON space_registry(user_id)
				`);

				console.log('Migration completed: user_id column added');
			}
		} catch (error) {
			console.error('Migration failed:', error);
		}

		// Migration: Create shared_chats_lookup table
		try {
			const cursor = this.ctx.storage.sql.exec(`
				SELECT name FROM sqlite_master WHERE type='table' AND name='shared_chats_lookup'
			`);
			const tables = [...cursor];

			if (tables.length === 0) {
				console.log('Running migration: Creating shared_chats_lookup table');

				this.ctx.storage.sql.exec(`
					CREATE TABLE shared_chats_lookup (
						share_id TEXT PRIMARY KEY,
						space_id TEXT NOT NULL,
						created_at INTEGER NOT NULL
					)
				`);

				console.log('Migration completed: shared_chats_lookup table created');
			}
		} catch (error) {
			console.error('Migration failed:', error);
		}
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const upgradeHeader = request.headers.get("Upgrade");

		// Handle internal HTTP request to get all spaces
		if (url.pathname === "/spaces") {
			const spaces = await this.getAllSpaces();
			return new Response(JSON.stringify(spaces), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		if (upgradeHeader === "websocket") {
			const webSocketPair = new WebSocketPair();
			const [client, server] = Object.values(webSocketPair);

			this.ctx.acceptWebSocket(server);

			return new Response(null, {
				status: 101,
				webSocket: client,
			});
		}

		return new Response("Expected WebSocket connection", { status: 400 });
	}

	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
		try {
			const data = typeof message === "string" ? message : new TextDecoder().decode(message);
			const request = JSON.parse(data);

			let response;

			try {
				const result = await this.handleMethod(request.method, request.params);
				response = { id: request.id, result };
			} catch (error) {
				response = {
					id: request.id,
					error: error instanceof Error ? error.message : "Unknown error",
				};
			}

			ws.send(JSON.stringify(response));
		} catch (error) {
			ws.send(JSON.stringify({ error: "Invalid message format" }));
		}
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
		console.log(`Registry WebSocket closed: code=${code}, reason=${reason}, wasClean=${wasClean}`);
	}

	async webSocketError(ws: WebSocket, error: unknown) {
		console.error("Registry WebSocket error:", error);
	}

	private async handleMethod(method: string, params: any): Promise<any> {
		switch (method) {
			case "registerSpace":
				return await this.registerSpace(params.spaceId, params.name, params.userId);
			case "getSpaces":
				return await this.getSpaces(params.userId);
			case "updateSpaceName":
				return await this.updateSpaceName(params.spaceId, params.name);
			case "unregisterSpace":
				return await this.unregisterSpace(params.spaceId);
			default:
				throw new Error(`Unknown method: ${method}`);
		}
	}

	async registerSpace(spaceId: string, name: string, userId?: string) {
		const now = Date.now();

		// Insert or replace space
		this.ctx.storage.sql.exec(
			`INSERT OR REPLACE INTO space_registry (space_id, name, created_at, user_id) VALUES (?, ?, ?, ?)`,
			spaceId,
			name,
			now,
			userId || null
		);

		return { success: true };
	}

	async getSpaces(userId?: string) {
		let cursor;

		if (userId) {
			// Filter by user_id if provided
			cursor = this.ctx.storage.sql.exec(
				`SELECT * FROM space_registry WHERE user_id = ? ORDER BY created_at DESC`,
				userId
			);
		} else {
			// Return all spaces if no userId (for backwards compatibility)
			cursor = this.ctx.storage.sql.exec(
				`SELECT * FROM space_registry ORDER BY created_at DESC`
			);
		}

		const spaces = [];
		for (const row of cursor) {
			spaces.push({
				id: row.space_id as string,
				name: row.name as string,
				createdAt: row.created_at as number,
			});
		}

		return spaces;
	}

	async getAllSpaces() {
		const cursor = this.ctx.storage.sql.exec(
			`SELECT space_id FROM space_registry`
		);

		const spaces = [];
		for (const row of cursor) {
			spaces.push({
				space_id: row.space_id as string,
			});
		}

		return spaces;
	}

	async updateSpaceName(spaceId: string, name: string) {
		this.ctx.storage.sql.exec(
			`UPDATE space_registry SET name = ? WHERE space_id = ?`,
			name,
			spaceId
		);

		return { success: true };
	}

	async unregisterSpace(spaceId: string) {
		this.ctx.storage.sql.exec(
			`DELETE FROM space_registry WHERE space_id = ?`,
			spaceId
		);

		return { success: true };
	}
}

export default {
	/**
	 * Worker fetch handler for Space management
	 * Routes requests to Space Durable Objects
	 * Hierarchy: Spaces → Chats → Messages
	 * Supports both HTTP REST API and WebSocket connections
	 */
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const upgradeHeader = request.headers.get("Upgrade");

		console.log('[Worker] Request received:', {
			method: request.method,
			path: path,
			url: url.toString(),
			headers: Object.fromEntries(request.headers.entries())
		});

		// CORS headers
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Upgrade, Connection",
		};

		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			console.log('[Worker] Handling CORS preflight');
			return new Response(null, { headers: corsHeaders });
		}

		// ========== OAuth Routes ==========

		// OAuth callback: http://localhost:8787/auth/callback?code=...
		if (path === "/auth/callback") {
			console.log('[OAuth] Callback received at /auth/callback');
			console.log('[OAuth] env.FRONTEND_URL:', env.FRONTEND_URL);
			console.log('[OAuth] All env keys:', Object.keys(env));
			const code = url.searchParams.get('code');
			console.log('[OAuth] Code present:', !!code);
			if (!code) {
				return new Response(JSON.stringify({ error: 'No authorization code provided' }), {
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			// Extract user ID from state parameter or create a session
			// For now, we'll use a simple approach - exchange the code directly
			try {
				console.log('[OAuth] Starting token exchange');
				// Exchange code for tokens
				const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: new URLSearchParams({
						code,
						client_id: env.GCP_OAUTH_CLIENT_ID,
						client_secret: env.GCP_OAUTH_CLIENT_SECRET,
						redirect_uri: `${url.origin}/auth/callback`,
						grant_type: 'authorization_code',
					}).toString(),
				});

				if (!tokenResponse.ok) {
					const error = await tokenResponse.text();
					console.error('[OAuth] Token exchange failed:', error);
					throw new Error(`Token exchange failed: ${error}`);
				}

				console.log('[OAuth] Token exchange successful');
				const tokens = await tokenResponse.json() as { access_token: string; id_token: string };

				console.log('[OAuth] Fetching user info');
				// Get user info
				const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
					headers: { Authorization: `Bearer ${tokens.access_token}` },
				});

				if (!userInfoResponse.ok) {
					console.error('[OAuth] Failed to get user info');
					throw new Error('Failed to get user info');
				}

				console.log('[OAuth] User info retrieved successfully');
				const userInfo = await userInfoResponse.json() as {
					id: string;
					email: string;
					name: string;
					picture: string;
				};

				console.log('[OAuth] User:', userInfo.email);

				// Redirect back to frontend app with user info
				console.log('[OAuth] Building redirect URL with FRONTEND_URL:', env.FRONTEND_URL);
				console.log('[OAuth] env type:', typeof env.FRONTEND_URL);
				console.log('[OAuth] env defined:', env.FRONTEND_URL !== undefined);

				if (!env.FRONTEND_URL) {
					console.error('[OAuth] FRONTEND_URL not defined in environment');
					throw new Error('FRONTEND_URL environment variable is not configured');
				}

				const frontendUrl = new URL('/', env.FRONTEND_URL);
				frontendUrl.searchParams.set('userId', userInfo.id);
				frontendUrl.searchParams.set('email', userInfo.email);
				frontendUrl.searchParams.set('name', userInfo.name);
				frontendUrl.searchParams.set('picture', userInfo.picture);

				console.log('[OAuth] Redirecting to:', frontendUrl.toString());

				return new Response(null, {
					status: 302,
					headers: {
						...corsHeaders,
						'Location': frontendUrl.toString(),
					},
				});
			} catch (error) {
				console.error('OAuth error:', error);
				return new Response(JSON.stringify({
					error: error instanceof Error ? error.message : 'Authentication failed'
				}), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}
		}

		// ========== Shared Chat API ==========

		// Get shared chat: GET /api/share/:shareId
		if (request.method === "GET" && path.match(/^\/api\/share\/[^/]+$/)) {
			const shareId = path.split("/")[3];

			try {
				// We need to query all spaces to find the one with this shareId
				// Get all spaces from registry
				const registryStub = env.SPACE_REGISTRY.get(env.SPACE_REGISTRY.idFromName("global-registry"));

				// Use a simple HTTP endpoint on registry to get spaces
				const spacesResponse = await registryStub.fetch(new Request("http://internal/spaces"));

				if (!spacesResponse.ok) {
					throw new Error("Failed to get spaces from registry");
				}

				const spaces = await spacesResponse.json() as Array<{ space_id: string }>;

				// Query each space to find the shared chat
				for (const space of spaces) {
					const spaceStub = env.SPACE.get(env.SPACE.idFromName(space.space_id));
					const sharedChatResponse = await spaceStub.fetch(
						new Request(`http://internal/shared/${shareId}`)
					);

					if (sharedChatResponse.ok) {
						const sharedChatData = await sharedChatResponse.json();
						return new Response(JSON.stringify(sharedChatData), {
							status: 200,
							headers: { ...corsHeaders, "Content-Type": "application/json" },
						});
					}
				}

				// Not found in any space
				return new Response(JSON.stringify({
					error: "Shared chat not found"
				}), {
					status: 404,
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});

			} catch (error) {
				console.error("Error fetching shared chat:", error);
				return new Response(JSON.stringify({
					error: error instanceof Error ? error.message : "Failed to fetch shared chat"
				}), {
					status: 500,
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}
		}

		// ========== WebSocket Routes ==========

		// WebSocket connection to user: ws://localhost:8787/user/:userId/ws
		if (upgradeHeader === "websocket" && path.match(/^\/user\/[^/]+\/ws$/)) {
			const userId = path.split("/")[2];
			const stub = env.USER.get(env.USER.idFromName(userId));
			return stub.fetch(request);
		}

		// WebSocket connection to space registry: ws://localhost:8787/registry/ws
		if (upgradeHeader === "websocket" && path === "/registry/ws") {
			const stub = env.SPACE_REGISTRY.get(env.SPACE_REGISTRY.idFromName("global-registry"));
			return stub.fetch(request);
		}

		// WebSocket connection: ws://localhost:8787/spaces/:spaceId/ws
		if (upgradeHeader === "websocket" && path.match(/^\/spaces\/[^/]+\/ws$/)) {
			const spaceId = path.split("/")[2];
			const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));

			// Forward the WebSocket upgrade request to the Durable Object
			return stub.fetch(request);
		}

		// All other requests return 404
		return new Response(JSON.stringify({ error: "Not found" }), {
			status: 404,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	},
} satisfies ExportedHandler<Env>;
