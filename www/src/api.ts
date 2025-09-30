export async function sendMessage(
  messages: Array<{role: 'user' | 'assistant', content: string}>, 
  model: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  try {
    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, model }),
    });

    if (!response.ok) {
      console.error('=== API ERROR RESPONSE ===');
      console.error('Response status:', response.status);
      console.error('Response statusText:', response.statusText);
      console.error('Response headers:', [...response.headers.entries()]);
      
      // Try to parse error response as JSON
      try {
        const errorData = await response.json();
        console.error('Parsed error data:', errorData);
        if (errorData.error) {
          console.error('Throwing error with message:', errorData.error);
          throw new Error(errorData.error);
        } else {
          console.error('No error field in response, using status');
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (jsonError) {
        console.error('Failed to parse error response as JSON:', jsonError);
        console.error('Falling back to status error');
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is null');
    }

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        console.log('Received chunk:', chunk); // Debug log
        
        // Check if this is an error response (JSON format)
        if (chunk.includes('"error"') && chunk.includes('}')) {
          try {
            const errorData = JSON.parse(chunk);
            if (errorData.error) {
              console.error('Received error in chunk:', errorData.error);
              throw new Error(errorData.error);
            }
          } catch (parseError) {
            // Not a JSON error, continue with normal chunk processing
          }
        }
        
        // If it's not an error, process as normal streaming text
        onChunk(chunk);
      }
    }
  } catch (error) {
    console.error('=== API.TS OUTER ERROR HANDLER ===');
    console.error('Error calling Claude API:', error);
    console.error('Error type:', typeof error);
    console.error('Error instanceof Error:', error instanceof Error);
    if (error instanceof Error) {
      console.error('Error.message:', error.message);
      console.error('Error.stack:', error.stack);
    }
    console.error('Error keys:', Object.keys(error || {}));
    
    console.error('Re-throwing error with message:', error instanceof Error ? error.message : 'Failed to get response from Claude');
    throw error instanceof Error ? error : new Error('Failed to get response from Claude');
  }
}