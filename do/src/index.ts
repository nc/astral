import { DurableObject } from "cloudflare:workers";
import type {
	ChatMessage,
	Chat,
	SpaceData,
	WebSocketMessage,
	WebSocketResponse,
} from "../../shared-types";

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
	}

	/**
	 * Handle WebSocket connections
	 */
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

		return new Response("Expected WebSocket", { status: 400 });
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

		// Create chats table
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
	 */
	async createChat(name?: string, metadata?: Record<string, any>): Promise<Chat> {
		const chatId = crypto.randomUUID();
		const now = Date.now();
		const chatName = name || `Chat ${chatId.slice(0, 8)}`;

		this.ctx.storage.sql.exec(
			`INSERT INTO chats (id, space_id, name, created_at, updated_at, metadata) VALUES (?, ?, ?, ?, ?, ?)`,
			chatId,
			this.spaceId,
			chatName,
			now,
			now,
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
			metadata,
		};
	}

	/**
	 * Get all chats in this space
	 */
	async getChats(limit?: number, offset?: number): Promise<Chat[]> {
		const query = limit !== undefined
			? `SELECT * FROM chats WHERE space_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?`
			: `SELECT * FROM chats WHERE space_id = ? ORDER BY updated_at DESC`;

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
	 * Handle WebSocket close
	 */
	async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
		ws.close(code, "Space Durable Object closing WebSocket");
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
				return await this.createChat(params?.name, params?.metadata);
			case "getChats":
				return await this.getChats(params?.limit, params?.offset);
			case "getChat":
				return await this.getChat(params.chatId);
			case "updateChatMetadata":
				const updated = await this.updateChatMetadata(params.chatId, params.metadata);
				if (!updated) throw new Error("Chat not found");
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
		// WebSocket connection: ws://localhost:8787/spaces/:spaceId/ws
		if (upgradeHeader === "websocket" && path.match(/^\/spaces\/[^/]+\/ws$/)) {
			const spaceId = path.split("/")[2];
			const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));

			// Forward the WebSocket upgrade request to the Durable Object
			return stub.fetch(request);
		}

		try {
			// ========== Space Routes ==========

			// GET /spaces/:spaceId - Get space info
			if (path.match(/^\/spaces\/[^/]+$/) && request.method === "GET") {
				const spaceId = path.split("/")[2];
				const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));
				const space = await stub.getOrCreateSpace();

				return new Response(JSON.stringify(space), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// PUT /spaces/:spaceId/metadata - Update space metadata
			if (path.match(/^\/spaces\/[^/]+\/metadata$/) && request.method === "PUT") {
				const spaceId = path.split("/")[2];
				const body = await request.json() as Record<string, any>;

				const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));
				await stub.updateSpaceMetadata(body);

				return new Response(JSON.stringify({ success: true }), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// ========== Chat Routes ==========

			// POST /spaces/:spaceId/chats - Create a new chat
			if (path.match(/^\/spaces\/[^/]+\/chats$/) && request.method === "POST") {
				const spaceId = path.split("/")[2];
				const body = await request.json() as { name?: string; metadata?: Record<string, any> };

				const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));
				const chat = await stub.createChat(body.name, body.metadata);

				return new Response(JSON.stringify(chat), {
					status: 201,
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// GET /spaces/:spaceId/chats - Get all chats in a space
			if (path.match(/^\/spaces\/[^/]+\/chats$/) && request.method === "GET") {
				const spaceId = path.split("/")[2];
				const limit = url.searchParams.get("limit");
				const offset = url.searchParams.get("offset");

				const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));
				const chats = await stub.getChats(
					limit ? parseInt(limit) : undefined,
					offset ? parseInt(offset) : undefined
				);

				return new Response(JSON.stringify(chats), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// GET /spaces/:spaceId/chats/count - Get chat count (must come before /:chatId route)
			if (path.match(/^\/spaces\/[^/]+\/chats\/count$/) && request.method === "GET") {
				const spaceId = path.split("/")[2];

				const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));
				const count = await stub.getChatCount();

				return new Response(JSON.stringify({ count }), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// GET /spaces/:spaceId/chats/:chatId - Get a specific chat
			if (path.match(/^\/spaces\/[^/]+\/chats\/[^/]+$/) && request.method === "GET") {
				const [, , spaceId, , chatId] = path.split("/");

				const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));
				const chat = await stub.getChat(chatId);

				if (!chat) {
					return new Response(JSON.stringify({ error: "Chat not found" }), {
						status: 404,
						headers: { ...corsHeaders, "Content-Type": "application/json" },
					});
				}

				return new Response(JSON.stringify(chat), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// PUT /spaces/:spaceId/chats/:chatId/metadata - Update chat metadata
			if (path.match(/^\/spaces\/[^/]+\/chats\/[^/]+\/metadata$/) && request.method === "PUT") {
				const [, , spaceId, , chatId] = path.split("/");
				const body = await request.json() as Record<string, any>;

				const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));
				const updated = await stub.updateChatMetadata(chatId, body);

				if (!updated) {
					return new Response(JSON.stringify({ error: "Chat not found" }), {
						status: 404,
						headers: { ...corsHeaders, "Content-Type": "application/json" },
					});
				}

				return new Response(JSON.stringify({ success: true }), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// DELETE /spaces/:spaceId/chats/:chatId - Delete a chat
			if (path.match(/^\/spaces\/[^/]+\/chats\/[^/]+$/) && request.method === "DELETE") {
				const [, , spaceId, , chatId] = path.split("/");

				const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));
				const deleted = await stub.deleteChat(chatId);

				if (!deleted) {
					return new Response(JSON.stringify({ error: "Chat not found" }), {
						status: 404,
						headers: { ...corsHeaders, "Content-Type": "application/json" },
					});
				}

				return new Response(JSON.stringify({ success: true }), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// ========== Message Routes ==========

			// POST /spaces/:spaceId/chats/:chatId/messages - Add a message to a chat
			if (path.match(/^\/spaces\/[^/]+\/chats\/[^/]+\/messages$/) && request.method === "POST") {
				const [, , spaceId, , chatId] = path.split("/");
				const body = await request.json() as { content: string; role: "user" | "assistant" | "system"; metadata?: Record<string, any> };

				if (!body.content || !body.role) {
					return new Response(JSON.stringify({ error: "Missing required fields: content, role" }), {
						status: 400,
						headers: { ...corsHeaders, "Content-Type": "application/json" },
					});
				}

				const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));
				const message = await stub.addMessage(chatId, body.content, body.role, body.metadata);

				return new Response(JSON.stringify(message), {
					status: 201,
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// GET /spaces/:spaceId/chats/:chatId/messages - Get all messages in a chat
			if (path.match(/^\/spaces\/[^/]+\/chats\/[^/]+\/messages$/) && request.method === "GET") {
				const [, , spaceId, , chatId] = path.split("/");
				const limit = url.searchParams.get("limit");
				const offset = url.searchParams.get("offset");

				const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));
				const messages = await stub.getMessages(
					chatId,
					limit ? parseInt(limit) : undefined,
					offset ? parseInt(offset) : undefined
				);

				return new Response(JSON.stringify(messages), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// GET /spaces/:spaceId/messages/:messageId - Get a specific message
			if (path.match(/^\/spaces\/[^/]+\/messages\/[^/]+$/) && request.method === "GET") {
				const [, , spaceId, , messageId] = path.split("/");

				const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));
				const message = await stub.getMessage(messageId);

				if (!message) {
					return new Response(JSON.stringify({ error: "Message not found" }), {
						status: 404,
						headers: { ...corsHeaders, "Content-Type": "application/json" },
					});
				}

				return new Response(JSON.stringify(message), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// DELETE /spaces/:spaceId/messages/:messageId - Delete a specific message
			if (path.match(/^\/spaces\/[^/]+\/messages\/[^/]+$/) && request.method === "DELETE") {
				const [, , spaceId, , messageId] = path.split("/");

				const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));
				const deleted = await stub.deleteMessage(messageId);

				if (!deleted) {
					return new Response(JSON.stringify({ error: "Message not found" }), {
						status: 404,
						headers: { ...corsHeaders, "Content-Type": "application/json" },
					});
				}

				return new Response(JSON.stringify({ success: true }), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// DELETE /spaces/:spaceId/chats/:chatId/messages - Clear all messages in a chat
			if (path.match(/^\/spaces\/[^/]+\/chats\/[^/]+\/messages$/) && request.method === "DELETE") {
				const [, , spaceId, , chatId] = path.split("/");

				const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));
				const count = await stub.clearMessages(chatId);

				return new Response(JSON.stringify({ deletedCount: count }), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// GET /spaces/:spaceId/chats/:chatId/count - Get message count for a chat
			if (path.match(/^\/spaces\/[^/]+\/chats\/[^/]+\/count$/) && request.method === "GET") {
				const [, , spaceId, , chatId] = path.split("/");

				const stub = env.SPACE.get(env.SPACE.idFromName(spaceId));
				const count = await stub.getMessageCount(chatId);

				return new Response(JSON.stringify({ count }), {
					headers: { ...corsHeaders, "Content-Type": "application/json" },
				});
			}

			// 404 - Route not found
			return new Response(JSON.stringify({ error: "Not found" }), {
				status: 404,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		} catch (error) {
			console.error("Error handling request:", error);
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			return new Response(JSON.stringify({ error: "Internal server error", message: errorMessage }), {
				status: 500,
				headers: { ...corsHeaders, "Content-Type": "application/json" },
			});
		}
	},
} satisfies ExportedHandler<Env>;
