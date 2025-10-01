/**
 * Test suite for WebSocket API
 * Tests Space Durable Objects via WebSocket connections
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from "ws";

const WS_URL = "ws://localhost:8787/spaces/test-ws-space/ws";

interface WSRequest {
	id: string;
	method: string;
	params?: any;
}

interface WSResponse {
	id: string;
	result?: any;
	error?: string;
}

let messageIdCounter = 0;
function generateId(): string {
	return `msg-${++messageIdCounter}`;
}

async function sendMessage(ws: WebSocket, method: string, params?: any): Promise<any> {
	return new Promise((resolve, reject) => {
		const id = generateId();
		const request: WSRequest = { id, method, params };

		const timeout = setTimeout(() => {
			reject(new Error(`Timeout waiting for response to ${method}`));
		}, 5000);

		const handler = (data: any) => {
			try {
				const response: WSResponse = JSON.parse(data.toString());
				if (response.id === id) {
					clearTimeout(timeout);
					ws.removeListener("message", handler);

					if (response.error) {
						reject(new Error(response.error));
					} else {
						resolve(response.result);
					}
				}
			} catch (error) {
				// Ignore parsing errors for other messages
			}
		};

		ws.on("message", handler);
		ws.send(JSON.stringify(request));
	});
}

describe('WebSocket API', () => {
	let ws: WebSocket;
	let chatId: string;
	let messageId: string;

	beforeAll(async () => {
		ws = new WebSocket(WS_URL);

		await new Promise<void>((resolve, reject) => {
			ws.on("open", () => resolve());
			ws.on("error", (error) => reject(error));
		});
	});

	afterAll(() => {
		if (ws) {
			ws.close();
		}
	});

	describe('Space Operations', () => {
		test('getOrCreateSpace - should create or get space', async () => {
			const space = await sendMessage(ws, "getOrCreateSpace", { name: "WebSocket Test Space" });
			expect(space.name).toBeDefined();
		});

		test('updateSpaceMetadata - should update space metadata', async () => {
			await sendMessage(ws, "updateSpaceMetadata", { metadata: { wsTest: true } });
			// If no error is thrown, the test passes
		});
	});

	describe('Chat Operations', () => {
		test('createChat - should create a new chat', async () => {
			const chat = await sendMessage(ws, "createChat", {
				name: "WebSocket Test Chat",
				metadata: { source: "websocket" },
			});
			chatId = chat.id;
			expect(chat.id).toBeDefined();
			expect(chat.name).toBe("WebSocket Test Chat");
		});

		test('getChats - should retrieve all chats', async () => {
			const chats = await sendMessage(ws, "getChats");
			expect(Array.isArray(chats)).toBe(true);
			expect(chats.length).toBeGreaterThan(0);
		});

		test('getChat - should retrieve specific chat', async () => {
			const retrievedChat = await sendMessage(ws, "getChat", { chatId });
			expect(retrievedChat.name).toBe("WebSocket Test Chat");
		});

		test('getChatCount - should return chat count', async () => {
			const chatCount = await sendMessage(ws, "getChatCount");
			expect(typeof chatCount).toBe("number");
			expect(chatCount).toBeGreaterThan(0);
		});

		test('updateChatMetadata - should update chat metadata', async () => {
			await sendMessage(ws, "updateChatMetadata", {
				chatId,
				metadata: { updated: true },
			});
			// If no error is thrown, the test passes
		});
	});

	describe('Message Operations', () => {
		test('addMessage - should add a user message', async () => {
			const message1 = await sendMessage(ws, "addMessage", {
				chatId,
				content: "Hello from WebSocket!",
				role: "user",
				metadata: { test: true },
			});
			messageId = message1.id;
			expect(message1.id).toBeDefined();
			expect(message1.content).toBe("Hello from WebSocket!");
		});

		test('addMessage - should add an assistant message', async () => {
			const message = await sendMessage(ws, "addMessage", {
				chatId,
				content: "Hello! How can I help you?",
				role: "assistant",
			});
			expect(message.id).toBeDefined();
		});

		test('getMessages - should retrieve all messages', async () => {
			const messages = await sendMessage(ws, "getMessages", { chatId });
			expect(Array.isArray(messages)).toBe(true);
			expect(messages.length).toBeGreaterThanOrEqual(2);
		});

		test('getMessage - should retrieve specific message', async () => {
			const retrievedMessage = await sendMessage(ws, "getMessage", { messageId });
			expect(retrievedMessage.content).toBe("Hello from WebSocket!");
		});

		test('getMessageCount - should return message count', async () => {
			const messageCount = await sendMessage(ws, "getMessageCount", { chatId });
			expect(typeof messageCount).toBe("number");
			expect(messageCount).toBeGreaterThanOrEqual(2);
		});

		test('getMessages with pagination - should limit results', async () => {
			const pagedMessages = await sendMessage(ws, "getMessages", {
				chatId,
				limit: 1,
				offset: 0,
			});
			expect(pagedMessages.length).toBe(1);
		});

		test('deleteMessage - should delete a message', async () => {
			await sendMessage(ws, "deleteMessage", { messageId });

			// Verify deletion
			await expect(
				sendMessage(ws, "getMessage", { messageId })
			).rejects.toThrow(/not found/);
		});

		test('clearMessages - should clear all messages', async () => {
			const clearResult = await sendMessage(ws, "clearMessages", { chatId });
			expect(clearResult.deletedCount).toBeDefined();
			expect(typeof clearResult.deletedCount).toBe("number");
		});
	});

	describe('Chat Deletion', () => {
		test('deleteChat - should delete a chat', async () => {
			await sendMessage(ws, "deleteChat", { chatId });

			// Verify deletion - API returns null for non-existent chat
			const result = await sendMessage(ws, "getChat", { chatId });
			expect(result).toBeNull();
		});
	});

	describe('Error Handling', () => {
		test('should handle invalid method', async () => {
			await expect(
				sendMessage(ws, "invalidMethod")
			).rejects.toThrow(/Unknown method/);
		});

		test('should handle missing params - returns null', async () => {
			const result = await sendMessage(ws, "getChat", {});
			expect(result).toBeNull();
		});
	});
});
