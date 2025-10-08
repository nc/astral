import { getWebSocketClient } from './websocket-client'

export async function sendMessage(
  spaceId: string,
  chatId: string,
  messages: Array<{role: 'user' | 'assistant', content: string}>,
  model: string,
  onChunk: (chunk: string) => void,
  onMessageStart?: () => void,
  onMessageEnd?: (content: string) => void,
  onToolCallMessage?: (message: any) => void,
  onToolResultMessage?: (message: any) => void
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

    // Track current assistant message content
    let currentAssistantContent = '';

    // Stream the AI response
    console.log('Starting AI stream...');
    await client.streamChat(
      chatId,
      messages,
      model,
      (chunk) => {
        currentAssistantContent += chunk;
        onChunk(chunk);
      },
      () => {
        // On message start - reset content accumulator
        console.log('Message started');
        currentAssistantContent = '';
        if (onMessageStart) onMessageStart();
      },
      async () => {
        // On message end - save the accumulated content
        if (currentAssistantContent) {
          console.log('Message ended, saving to backend:', currentAssistantContent.length, 'chars');
          const savedMsg = await client.addMessage(chatId, currentAssistantContent, 'assistant', { timestamp: Date.now() });
          console.log('Assistant message saved with ID:', savedMsg.id);
          if (onMessageEnd) onMessageEnd(currentAssistantContent);
        }
      },
      (toolName, args) => {
        // On tool call
        console.log('🔧 [TOOL CALL EVENT]', toolName, args);
      },
      (toolName, result) => {
        // On tool result
        console.log('✅ [TOOL RESULT EVENT]', toolName, result);
      },
      (message) => {
        // On tool call message created in backend
        console.log('💾 [TOOL CALL MESSAGE CREATED]', message);
        if (onToolCallMessage) onToolCallMessage(message);
      },
      (message) => {
        // On tool result message created in backend
        console.log('💾 [TOOL RESULT MESSAGE CREATED]', message);
        if (onToolResultMessage) onToolResultMessage(message);
      }
    );
    console.log('AI stream completed');
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
    return `${window.location.origin}/share/${result.shareId}`;
  } catch (error) {
    console.error('Error sharing chat:', error);
    throw error instanceof Error ? error : new Error('Failed to share chat');
  }
}
