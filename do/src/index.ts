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
	 * Handle WebSocket connections only
	 */
	async fetch(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get("Upgrade");

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
		this.ctx.storage.sql.exec(
			`UPDATE spaces SET metadata = ?, updated_at = ? WHERE id = ?`,
			JSON.stringify(metadata),
			Date.now(),
			this.spaceId
		);
	}

	// ============== Chat Methods ==============

	/**
	 * Create a new chat in this space
	 * Position parameter allows inserting at specific position (for branching)
	 */
	async createChat(name?: string, metadata?: Record<string, any>, position?: number): Promise<Chat> {
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
			`INSERT INTO chats (id, space_id, name, created_at, updated_at, position, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			chatId,
			this.spaceId,
			chatName,
			now,
			now,
			chatPosition,
			metadata ? JSON.stringify(metadata) : null
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

	// ============== Message Methods ==============

	/**
	 * Add a message to a chat
	 */
	async addMessage(chatId: string, content: string, role: "user" | "assistant" | "system", metadata?: Record<string, any>): Promise<ChatMessage> {
		const messageId = crypto.randomUUID();
		const timestamp = Date.now();

		this.ctx.storage.sql.exec(
			`INSERT INTO messages (id, chat_id, content, role, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)`,
			messageId,
			chatId,
			content,
			role,
			timestamp,
			metadata ? JSON.stringify(metadata) : null
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
			messages.push({
				id: row.id as string,
				chatId: row.chat_id as string,
				content: row.content as string,
				role: row.role as "user" | "assistant" | "system",
				timestamp: row.timestamp as number,
				metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined,
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
			const { messages, model } = request.params;

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

				for await (const chunk of stream.textStream) {
					ws.send(JSON.stringify({
						id: request.id,
						type: 'chunk',
						data: chunk,
					}));
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
				return await this.createChat(params?.name, params?.metadata, params?.position);
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

/** Space Registry Durable Object - tracks all spaces */
export class SpaceRegistryDurableObject extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.initializeDatabase();
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

	async fetch(request: Request): Promise<Response> {
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
				return await this.registerSpace(params.spaceId, params.name);
			case "getSpaces":
				return await this.getSpaces();
			case "unregisterSpace":
				return await this.unregisterSpace(params.spaceId);
			default:
				throw new Error(`Unknown method: ${method}`);
		}
	}

	async registerSpace(spaceId: string, name: string) {
		const now = Date.now();

		// Insert or replace space
		this.ctx.storage.sql.exec(
			`INSERT OR REPLACE INTO space_registry (space_id, name, created_at) VALUES (?, ?, ?)`,
			spaceId,
			name,
			now
		);

		return { success: true };
	}

	async getSpaces() {
		const cursor = this.ctx.storage.sql.exec(
			`SELECT * FROM space_registry ORDER BY created_at DESC`
		);

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

	async unregisterSpace(spaceId: string) {
		this.ctx.storage.sql.exec(
			`DELETE FROM space_registry WHERE space_id = ?`,
			spaceId
		);

		return { success: true };
	}
}

/** Legacy Durable Object - kept for backwards compatibility */
export class MyDurableObject extends DurableObject<Env> {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async sayHello(name: string): Promise<string> {
		return `Hello, ${name}!`;
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

		// CORS headers
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type, Upgrade, Connection",
		};

		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		// ========== WebSocket Routes ==========

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
		return new Response(JSON.stringify({ error: "Not found. Use WebSocket connection at /spaces/:spaceId/ws or /registry/ws" }), {
			status: 404,
			headers: { ...corsHeaders, "Content-Type": "application/json" },
		});
	},
} satisfies ExportedHandler<Env>;
