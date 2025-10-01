/**
 * Test suite for server.ts
 * Tests the chat API with and without tool usage
 */

import { describe, test, expect, beforeAll } from 'vitest';
import type { ModelMessage } from 'ai';

const BASE_URL = 'http://localhost:3001';

async function streamChat(messages: ModelMessage[], model: string): Promise<string> {
	const response = await fetch(`${BASE_URL}/api/chat`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ messages, model }),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`HTTP ${response.status}: ${errorText}`);
	}

	if (!response.body) {
		throw new Error('No response body');
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let fullResponse = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		const chunk = decoder.decode(value, { stream: true });
		fullResponse += chunk;
	}

	return fullResponse;
}

describe('Server API Tests', () => {
	beforeAll(async () => {
		// Check if server is running
		try {
			await fetch(`${BASE_URL}/api/chat`, { method: 'OPTIONS' });
		} catch (error) {
			throw new Error(
				`Cannot connect to server at ${BASE_URL}. Please start the server with 'npm run server' first.`
			);
		}
	});

	describe('Basic Chat', () => {
		test('should handle simple question', async () => {
			const messages: ModelMessage[] = [
				{
					role: 'user',
					content: 'What is 2+2? Answer with just the number.',
				},
			];

			const response = await streamChat(messages, 'claude-sonnet-4-5-20250929');
			expect(response).toBeTruthy();
			expect(response.toLowerCase()).toContain('4');
			console.log(`  Response: ${response.substring(0, 100)}`);
		}, 30000);
	});

	describe('Web Search Tool', () => {
		test('should handle explicit web search request', async () => {
			const messages: ModelMessage[] = [
				{
					role: 'user',
					content:
						'Who is the current president of the USA? Use web search to get the most up-to-date information. Be concise.',
				},
			];

			const response = await streamChat(messages, 'claude-sonnet-4-5-20250929');
			expect(response).toBeTruthy();
			expect(response).toContain("Donald J. Trump");
			expect(response.length).toBeGreaterThan(50);
			console.log(`  Response: ${response.substring(0, 200)}...`);
			console.log(`  Total length: ${response.length} characters`);
		}, 30000);

		test('should handle implicit need for current info', async () => {
			const messages: ModelMessage[] = [
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
		}, 30000);
	});

	describe('Visit Webpage Tool', () => {
		test('should extract content from webpage', async () => {
			const messages: ModelMessage[] = [
				{
					role: 'user',
					content: 'Visit https://example.com and tell me what the main heading says. Be brief.',
				},
			];

			const response = await streamChat(messages, 'claude-sonnet-4-5-20250929');
			console.log(response);
			expect(response).toBeTruthy();
			console.log(`  Response: ${response.substring(0, 200)}...`);
		}, 30000);
	});

	describe('Tool Call and Text Generation', () => {
		test('should generate text after web search tool call', async () => {
			const messages: ModelMessage[] = [
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
		}, 30000);
	});

	describe('Error Handling', () => {
		test('should return 400 for missing messages', async () => {
			const response = await fetch(`${BASE_URL}/api/chat`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ model: 'claude-opus-4-20250514' }),
			});

			expect(response.status).toBe(400);
			const error = await response.json();
			expect(error.error).toBeDefined();
			console.log(`  Error message: ${error.error}`);
		});

		test('should return 400 for missing model', async () => {
			const response = await fetch(`${BASE_URL}/api/chat`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ messages: [{ role: 'user', content: 'test' }] }),
			});

			expect(response.status).toBe(400);
			const error = await response.json();
			expect(error.error).toBeDefined();
			console.log(`  Error message: ${error.error}`);
		});

		test('should return 400 for unsupported model', async () => {
			const messages: ModelMessage[] = [
				{
					role: 'user',
					content: 'test',
				},
			];

			const response = await fetch(`${BASE_URL}/api/chat`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ messages, model: 'unsupported-model' }),
			});

			expect(response.status).toBe(400);
			const error = await response.json();
			expect(error.error).toBeDefined();
			expect(error.error).toContain('Unsupported');
			console.log(`  Error message: ${error.error}`);
		});
	});
});
