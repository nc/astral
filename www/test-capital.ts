/**
 * Simple script to test server.ts with a specific question
 * Logs all output including streaming chunks
 */

const BASE_URL = 'http://localhost:3001';

async function testCapitalQuestion() {
	console.log('Starting test: "What is the capital of France? use web search"\n');

	const messages = [
		{
			role: 'user' as const,
			content: 'What is the capital of France? use web search',
		},
	];

	console.log('Request:');
	console.log(JSON.stringify({ messages, model: 'claude-opus-4-20250514' }, null, 2));
	console.log('\n' + '='.repeat(50));
	console.log('Response stream:');
	console.log('='.repeat(50) + '\n');

	try {
		const response = await fetch(`${BASE_URL}/api/chat`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				messages,
				model: 'claude-opus-4-20250514',
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error(`HTTP ${response.status}: ${errorText}`);
			process.exit(1);
		}

		if (!response.body) {
			console.error('No response body');
			process.exit(1);
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let fullResponse = '';
		let chunkCount = 0;

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value, { stream: true });
			chunkCount++;

			// Log each chunk
			process.stdout.write(chunk);
			fullResponse += chunk;
		}

		console.log('\n\n' + '='.repeat(50));
		console.log('Response complete');
		console.log('='.repeat(50));
		console.log(`Total chunks: ${chunkCount}`);
		console.log(`Total length: ${fullResponse.length} characters`);
		console.log(`\nFull response:\n${fullResponse}`);

		// Verify the response mentions Paris
		if (fullResponse.toLowerCase().includes('paris')) {
			console.log('\n✓ Response correctly mentions Paris as the capital of France');
			process.exit(0);
		} else {
			console.log('\n✗ FAILED: Response does not mention Paris');
			console.log('Expected the response to include "Paris" but it was not found.');
			process.exit(1);
		}
	} catch (error) {
		console.error('\nError:', error instanceof Error ? error.message : error);
		process.exit(1);
	}
}

// Check if server is running
fetch(`${BASE_URL}/api/chat`, { method: 'OPTIONS' })
	.then(() => {
		console.log('Server is running\n');
		testCapitalQuestion();
	})
	.catch(() => {
		console.error(`Cannot connect to server at ${BASE_URL}`);
		console.error('Please start the server with "npm run server" first');
		process.exit(1);
	});
