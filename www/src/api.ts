import { getWebSocketClient } from './websocket-client'

export async function sendMessage(
  spaceId: string,
  chatId: string,
  messages: Array<{role: 'user' | 'assistant', content: string}>,
  model: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  try {
    console.log(`sendMessage: spaceId=${spaceId}, chatId=${chatId}, model=${model}`);
    const client = await getWebSocketClient(spaceId);

    // Save user message to backend first
    const userMessage = messages[messages.length - 1];
    if (userMessage.role === 'user') {
      console.log('Saving user message to backend:', userMessage.content);
      const savedUserMsg = await client.addMessage(chatId, userMessage.content, 'user', { timestamp: Date.now() });
      console.log('User message saved with ID:', savedUserMsg.id);
    }

    // Create a placeholder for the assistant message
    let assistantContent = '';

    // Stream the AI response
    console.log('Starting AI stream...');
    await client.streamChat(messages, model, (chunk) => {
      assistantContent += chunk;
      onChunk(chunk);
    });
    console.log('AI stream completed, assistant content length:', assistantContent.length);

    // Save the complete assistant message to backend
    if (assistantContent) {
      console.log('Saving assistant message to backend');
      const savedAssistantMsg = await client.addMessage(chatId, assistantContent, 'assistant', { timestamp: Date.now() });
      console.log('Assistant message saved with ID:', savedAssistantMsg.id);
    }
  } catch (error) {
    console.error('Error in sendMessage:', error);
    throw error instanceof Error ? error : new Error('Failed to get response from AI');
  }
}

export async function shareChat(spaceId: string, chatId: string): Promise<string> {
  try {
    console.log(`shareChat: spaceId=${spaceId}, chatId=${chatId}`);
    const client = await getWebSocketClient(spaceId);
    const result = await client.shareChat(chatId);

    // Return the share URL
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787';
    return `${window.location.origin}/share/${result.shareId}`;
  } catch (error) {
    console.error('Error sharing chat:', error);
    throw error instanceof Error ? error : new Error('Failed to share chat');
  }
}
