/**
 * Test suite for Space Durable Objects API via WebSocket
 * Tests the hierarchy: Spaces → Chats → Messages
 * Also tests AI Chat API with agent functionality
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';

const WS_URL = "ws://localhost:8787/spaces/test-space-1/ws";

// Test variables to share between tests
let createdChatId: string;
let createdMessageId: string;
let ws: WebSocket;

let messageIdCounter = 0;
function generateId(): string {
	return `msg-${++messageIdCounter}`;
}

async function sendMessage(method: string, params?: any): Promise<any> {
	return new Promise((resolve, reject) => {
		const id = generateId();
		const request = { id, method, params };

		const timeout = setTimeout(() => {
			reject(new Error(`Timeout waiting for response to ${method}`));
		}, 60000);

		const handler = (data: any) => {
			try {
				const response = JSON.parse(data.toString());
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

async function streamChat(messages: any[], model: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const id = generateId();
		let fullResponse = '';

		const timeout = setTimeout(() => {
			reject(new Error('Timeout waiting for chat stream'));
		}, 60000);

		const handler = (data: any) => {
			try {
				const response = JSON.parse(data.toString());

				if (response.id !== id) return;

				if (response.error) {
					clearTimeout(timeout);
					ws.removeListener("message", handler);
					reject(new Error(response.error));
					return;
				}

				if (response.type === 'start') {
					// Stream started
				} else if (response.type === 'chunk') {
					fullResponse += response.data;
				} else if (response.type === 'done') {
					clearTimeout(timeout);
					ws.removeListener("message", handler);
					resolve(fullResponse);
				}
			} catch (error) {
				// Ignore parsing errors
			}
		};

		ws.on("message", handler);
		ws.send(JSON.stringify({
			id,
			method: 'streamChat',
			params: { messages, model },
		}));
	});
}

describe('Space Durable Objects API via WebSocket', () => {
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

	// ========== Space Tests ==========
	describe('Spaces', () => {
		test('getOrCreateSpace - should create and return space info', async () => {
			const space = await sendMessage('getOrCreateSpace', { name: 'Test Space' });
			expect(space.id).toBeDefined();
			expect(space.name).toBeDefined();
			expect(space.createdAt).toBeDefined();
			expect(space.updatedAt).toBeDefined();
		});

		test('updateSpaceMetadata - should update space metadata', async () => {
			const result = await sendMessage('updateSpaceMetadata', { metadata: { theme: "dark", version: "1.0" } });
			expect(result.success).toBe(true);
		});
	});

	// ========== Chat Tests ==========
	describe('Chats', () => {
		test('createChat - should create a new chat', async () => {
			const chat = await sendMessage('createChat', { name: "Test Chat", metadata: { type: "test" } });
			expect(chat.id).toBeDefined();
			expect(chat.name).toBeDefined();
			expect(chat.spaceId).toBeDefined();
			expect(chat.name).toBe("Test Chat");

			createdChatId = chat.id; // Save for later tests
		});

		test('getChats - should list all chats', async () => {
			const chats = await sendMessage('getChats');
			expect(chats).toBeDefined();
			expect(Array.isArray(chats)).toBe(true);
			expect(chats.length).toBeGreaterThan(0);
		});

		test('getChat - should get specific chat', async () => {
			const chat = await sendMessage('getChat', { chatId: createdChatId });
			expect(chat.id).toBe(createdChatId);
			expect(chat.name).toBe("Test Chat");
		});

		test('updateChatMetadata - should update chat metadata', async () => {
			const result = await sendMessage('updateChatMetadata', { chatId: createdChatId, metadata: { updated: true } });
			expect(result.success).toBe(true);
		});

		test('getChatCount - should return chat count', async () => {
			const count = await sendMessage('getChatCount');
			expect(typeof count).toBe("number");
		});
	});

	// ========== Message Tests ==========
	describe('Messages', () => {
		test('addMessage - should add a user message', async () => {
			const message = await sendMessage('addMessage', {
				chatId: createdChatId,
				content: "Hello, world!",
				role: "user",
				metadata: { test: true }
			});
			expect(message.id).toBeDefined();
			expect(message.chatId).toBe(createdChatId);
			expect(message.content).toBe("Hello, world!");
			expect(message.role).toBe("user");

			createdMessageId = message.id; // Save for later tests
		});

		test('addMessage - should add assistant message', async () => {
			const message = await sendMessage('addMessage', {
				chatId: createdChatId,
				content: "Hello! How can I help you?",
				role: "assistant"
			});
			expect(message.id).toBeDefined();
		});

		test('getMessages - should list all messages', async () => {
			const messages = await sendMessage('getMessages', { chatId: createdChatId });
			expect(messages).toBeDefined();
			expect(Array.isArray(messages)).toBe(true);
			expect(messages.length).toBeGreaterThanOrEqual(2);
			// Check chronological order
			expect(messages[0].role).toBe("user");
			expect(messages[1].role).toBe("assistant");
		});

		test('getMessages - pagination should limit results', async () => {
			const messages = await sendMessage('getMessages', { chatId: createdChatId, limit: 1 });
			expect(messages.length).toBe(1);
		});

		test('getMessage - should get specific message', async () => {
			const message = await sendMessage('getMessage', { messageId: createdMessageId });
			expect(message.id).toBe(createdMessageId);
			expect(message.content).toBe("Hello, world!");
		});

		test('getMessageCount - should return message count', async () => {
			const count = await sendMessage('getMessageCount', { chatId: createdChatId });
			expect(typeof count).toBe("number");
			expect(count).toBeGreaterThanOrEqual(2);
		});

		test('deleteMessage - should delete a message', async () => {
			const result = await sendMessage('deleteMessage', { messageId: createdMessageId });
			expect(result.success).toBe(true);

			// Verify deletion
			await expect(
				sendMessage('getMessage', { messageId: createdMessageId })
			).rejects.toThrow(/not found/);
		});

		test('clearMessages - should clear all messages', async () => {
			// Add a new message first
			await sendMessage('addMessage', {
				chatId: createdChatId,
				content: "To be cleared",
				role: "user"
			});

			const result = await sendMessage('clearMessages', { chatId: createdChatId });
			expect(result.deletedCount).toBeDefined();

			// Verify messages are cleared
			const messages = await sendMessage('getMessages', { chatId: createdChatId });
			expect(messages.length).toBe(0);
		});
	});

	// ========== Chat Deletion Tests ==========
	describe('Chat Deletion', () => {
		test('deleteChat - should delete chat and messages', async () => {
			// Create a new chat for deletion
			const newChat = await sendMessage('createChat', { name: "Chat to delete" });

			// Delete it
			const result = await sendMessage('deleteChat', { chatId: newChat.id });
			expect(result.success).toBe(true);

			// Verify deletion
			await expect(
				sendMessage('getChat', { chatId: newChat.id })
			).rejects.toThrow();
		});
	});

	// ========== Error Cases ==========
	describe('Error Handling', () => {
		test('should handle non-existent chat', async () => {
			const result = await sendMessage('getChat', { chatId: 'non-existent-chat-id' });
			expect(result).toBeNull();
		});

		test('should handle non-existent message', async () => {
			await expect(
				sendMessage('getMessage', { messageId: 'non-existent-message-id' })
			).rejects.toThrow(/not found/);
		});

		test('should handle invalid method', async () => {
			await expect(
				sendMessage('invalidMethod')
			).rejects.toThrow(/Unknown method/);
		});
	});

	// ========== AI Chat API Tests ==========
	describe('AI Chat API', () => {
		describe('Basic Chat', () => {
			test('should handle simple question', async () => {
				const messages = [
					{
						role: 'user',
						content: 'What is 2+2? Answer with just the number.',
					},
				];

				const response = await streamChat(messages, 'claude-sonnet-4-5-20250929');
				expect(response).toBeTruthy();
				expect(response.toLowerCase()).toContain('4');
				console.log(`  Response: ${response.substring(0, 100)}`);
			}, 60000);
		});

		describe('Web Search Tool', () => {
			test('should handle explicit web search request', async () => {
				const messages = [
					{
						role: 'user',
						content:
							'Who is the current president of the USA? Use web search to get the most up-to-date information. Be concise.',
					},
				];

				const response = await streamChat(messages, 'claude-sonnet-4-5-20250929');
				expect(response).toBeTruthy();
				expect(response).toContain('Donald Trump');
				expect(response.length).toBeGreaterThan(50);
				console.log(`  Response: ${response.substring(0, 200)}...`);
				console.log(`  Total length: ${response.length} characters`);
			}, 60000);

			test('should handle implicit need for current info', async () => {
				const messages = [
					{
						role: 'user',
						content: 'What are the latest developments in AI in 2025? Search for recent news.',
					},
				];

				const response = await streamChat(messages, 'claude-sonnet-4-5-20250929');
				expect(response).toBeTruthy();
				expect(response.length).toBeGreaterThan(50);
				console.log(`  Response length: ${response.length} characters`);
				console.log(`  First 150 chars: ${response.substring(0, 150)}...`);
			}, 60000);
		});

		describe('Visit Webpage Tool', () => {
			test('should extract content from webpage', async () => {
				const messages = [
					{
						role: 'user',
						content: 'Visit https://example.com and tell me what the main heading says. Be brief.',
					},
				];

				const response = await streamChat(messages, 'claude-sonnet-4-5-20250929');
				console.log(response);
				expect(response).toBeTruthy();
				console.log(`  Response: ${response.substring(0, 200)}...`);
			}, 60000);
		});

		describe('Tool Call and Text Generation', () => {
			test('should generate text after web search tool call', async () => {
				const messages = [
					{
						role: 'user',
						content: 'What is 5+5? Then search the web and tell me: what is the capital of France?',
					},
				];

				const response = await streamChat(messages, 'claude-sonnet-4-5-20250929');
				expect(response).toBeTruthy();
				expect(response.length).toBeGreaterThan(15);
				console.log(`  Response: ${response.substring(0, 200)}...`);
				console.log(`  Length: ${response.length} chars - Tool called and LLM continued generation ✓`);
			}, 60000);
		});

		describe('AI Chat Error Handling', () => {
			test('should return error for missing messages', async () => {
				await expect(
					streamChat([], 'claude-opus-4-20250514')
				).rejects.toThrow(/Messages array is required/);
			});

			test('should return error for missing model', async () => {
				await expect(
					streamChat([{ role: 'user', content: 'test' }], '')
				).rejects.toThrow(/Model is required/);
			});

			test('should return error for unsupported model', async () => {
				await expect(
					streamChat([{ role: 'user', content: 'test' }], 'unsupported-model')
				).rejects.toThrow(/Unsupported model/);
			});
		});
	});
});
