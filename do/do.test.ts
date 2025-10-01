/**
 * Test suite for Space Durable Objects API
 * Tests the hierarchy: Spaces → Chats → Messages
 */

import { describe, test, expect, beforeAll } from 'vitest';

const BASE_URL = "http://localhost:8787";
const TEST_SPACE_ID = "test-space-1";

// Test variables to share between tests
let createdChatId: string;
let createdMessageId: string;

async function assertStatus(response: Response, expectedStatus: number) {
	if (response.status !== expectedStatus) {
		const body = await response.text();
		throw new Error(
			`Expected status ${expectedStatus} but got ${response.status}. Body: ${body}`
		);
	}
}

describe('Space Durable Objects API', () => {
	// ========== Space Tests ==========
	describe('Spaces', () => {
		test('GET /spaces/:spaceId - should create and return space info', async () => {
			const response = await fetch(`${BASE_URL}/spaces/${TEST_SPACE_ID}`);
			await assertStatus(response, 200);

			const space = await response.json();
			expect(space.id).toBeDefined();
			expect(space.name).toBeDefined();
			expect(space.createdAt).toBeDefined();
			expect(space.updatedAt).toBeDefined();
		});

		test('PUT /spaces/:spaceId/metadata - should update space metadata', async () => {
			const metadata = { theme: "dark", version: "1.0" };
			const response = await fetch(`${BASE_URL}/spaces/${TEST_SPACE_ID}/metadata`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(metadata),
			});
			await assertStatus(response, 200);

			const result = await response.json();
			expect(result.success).toBe(true);
		});
	});

	// ========== Chat Tests ==========
	describe('Chats', () => {
		test('POST /spaces/:spaceId/chats - should create a new chat', async () => {
			const response = await fetch(`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Test Chat", metadata: { type: "test" } }),
			});
			await assertStatus(response, 201);

			const chat = await response.json();
			expect(chat.id).toBeDefined();
			expect(chat.name).toBeDefined();
			expect(chat.spaceId).toBeDefined();
			expect(chat.name).toBe("Test Chat");

			createdChatId = chat.id; // Save for later tests
		});

		test('GET /spaces/:spaceId/chats - should list all chats', async () => {
			const response = await fetch(`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats`);
			await assertStatus(response, 200);

			const chats = await response.json();
			expect(chats).toBeDefined();
			expect(Array.isArray(chats)).toBe(true);
			expect(chats.length).toBeGreaterThan(0);
		});

		test('GET /spaces/:spaceId/chats/:chatId - should get specific chat', async () => {
			const response = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/${createdChatId}`
			);
			await assertStatus(response, 200);

			const chat = await response.json();
			expect(chat.id).toBe(createdChatId);
			expect(chat.name).toBe("Test Chat");
		});

		test('PUT /spaces/:spaceId/chats/:chatId/metadata - should update chat metadata', async () => {
			const metadata = { updated: true };
			const response = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/${createdChatId}/metadata`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(metadata),
				}
			);
			await assertStatus(response, 200);

			const result = await response.json();
			expect(result.success).toBe(true);
		});

		test('GET /spaces/:spaceId/chats/count - should return chat count', async () => {
			const response = await fetch(`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/count`);
			await assertStatus(response, 200);

			const result = await response.json();
			expect(result.count).toBeDefined();
			expect(typeof result.count).toBe("number");
		});
	});

	// ========== Message Tests ==========
	describe('Messages', () => {
		test('POST /spaces/:spaceId/chats/:chatId/messages - should add a message', async () => {
			const response = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/${createdChatId}/messages`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						content: "Hello, world!",
						role: "user",
						metadata: { test: true },
					}),
				}
			);
			await assertStatus(response, 201);

			const message = await response.json();
			expect(message.id).toBeDefined();
			expect(message.chatId).toBe(createdChatId);
			expect(message.content).toBe("Hello, world!");
			expect(message.role).toBe("user");

			createdMessageId = message.id; // Save for later tests
		});

		test('POST - should add assistant message', async () => {
			const response = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/${createdChatId}/messages`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						content: "Hello! How can I help you?",
						role: "assistant",
					}),
				}
			);
			await assertStatus(response, 201);
		});

		test('POST - should reject message with missing fields', async () => {
			const response = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/${createdChatId}/messages`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ content: "Missing role" }),
				}
			);
			await assertStatus(response, 400);
		});

		test('GET /spaces/:spaceId/chats/:chatId/messages - should list all messages', async () => {
			const response = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/${createdChatId}/messages`
			);
			await assertStatus(response, 200);

			const messages = await response.json();
			expect(messages).toBeDefined();
			expect(Array.isArray(messages)).toBe(true);
			expect(messages.length).toBeGreaterThanOrEqual(2);
			// Check chronological order
			expect(messages[0].role).toBe("user");
			expect(messages[1].role).toBe("assistant");
		});

		test('GET with pagination - should limit results', async () => {
			const response = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/${createdChatId}/messages?limit=1`
			);
			await assertStatus(response, 200);

			const messages = await response.json();
			expect(messages.length).toBe(1);
		});

		test('GET /spaces/:spaceId/messages/:messageId - should get specific message', async () => {
			const response = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/messages/${createdMessageId}`
			);
			await assertStatus(response, 200);

			const message = await response.json();
			expect(message.id).toBe(createdMessageId);
			expect(message.content).toBe("Hello, world!");
		});

		test('GET /spaces/:spaceId/chats/:chatId/count - should return message count', async () => {
			const response = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/${createdChatId}/count`
			);
			await assertStatus(response, 200);

			const result = await response.json();
			expect(result.count).toBeDefined();
			expect(result.count).toBeGreaterThanOrEqual(2);
		});

		test('DELETE /spaces/:spaceId/messages/:messageId - should delete a message', async () => {
			const response = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/messages/${createdMessageId}`,
				{ method: "DELETE" }
			);
			await assertStatus(response, 200);

			const result = await response.json();
			expect(result.success).toBe(true);

			// Verify it's deleted
			const getResponse = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/messages/${createdMessageId}`
			);
			await assertStatus(getResponse, 404);
		});

		test('DELETE /spaces/:spaceId/chats/:chatId/messages - should clear all messages', async () => {
			// Add a new message first
			await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/${createdChatId}/messages`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ content: "To be cleared", role: "user" }),
				}
			);

			const response = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/${createdChatId}/messages`,
				{ method: "DELETE" }
			);
			await assertStatus(response, 200);

			const result = await response.json();
			expect(result.deletedCount).toBeDefined();

			// Verify messages are cleared
			const getResponse = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/${createdChatId}/messages`
			);
			const messages = await getResponse.json();
			expect(messages.length).toBe(0);
		});
	});

	// ========== Chat Deletion Tests ==========
	describe('Chat Deletion', () => {
		test('DELETE /spaces/:spaceId/chats/:chatId - should delete chat and messages', async () => {
			// Create a new chat for deletion
			const createResponse = await fetch(`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "Chat to delete" }),
			});
			const newChat = await createResponse.json();

			// Delete it
			const response = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/${newChat.id}`,
				{ method: "DELETE" }
			);
			await assertStatus(response, 200);

			const result = await response.json();
			expect(result.success).toBe(true);

			// Verify it's deleted
			const getResponse = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/${newChat.id}`
			);
			await assertStatus(getResponse, 404);
		});
	});

	// ========== Error Cases ==========
	describe('Error Handling', () => {
		test('GET non-existent chat - should return 404', async () => {
			const response = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/non-existent-chat-id`
			);
			await assertStatus(response, 404);
		});

		test('GET non-existent message - should return 404', async () => {
			const response = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/messages/non-existent-message-id`
			);
			await assertStatus(response, 404);
		});

		test('DELETE non-existent chat - should return 404', async () => {
			const response = await fetch(
				`${BASE_URL}/spaces/${TEST_SPACE_ID}/chats/non-existent-chat-id`,
				{ method: "DELETE" }
			);
			await assertStatus(response, 404);
		});
	});
});
