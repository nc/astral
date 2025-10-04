/**
 * WebSocket client for communicating with Durable Objects backend
 * Handles all CRUD operations and AI chat streaming
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8787';
const WS_URL = BACKEND_URL.replace('http://', 'ws://').replace('https://', 'wss://');

let messageIdCounter = 0;
function generateMessageId(): string {
  return `msg-${++messageIdCounter}-${Date.now()}`;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private spaceId: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers = new Map<string, (response: any) => void>();
  private onReconnect?: () => void;

  constructor(spaceId: string) {
    this.spaceId = spaceId;
  }

  /**
   * Connect to WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${WS_URL}/spaces/${this.spaceId}/ws`;
      console.log('Connecting to WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(new Error('WebSocket connection error'));
      };

      this.ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          const handler = this.messageHandlers.get(response.id);
          if (handler) {
            handler(response);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.attemptReconnect();
      };
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);

    setTimeout(async () => {
      try {
        await this.connect();
        if (this.onReconnect) {
          this.onReconnect();
        }
      } catch (error) {
        console.error('Reconnect failed:', error);
      }
    }, delay);
  }

  /**
   * Set callback for reconnection events
   */
  setOnReconnect(callback: () => void) {
    this.onReconnect = callback;
  }

  /**
   * Send a method call and wait for response
   */
  private async call(method: string, params?: any, timeout: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = generateMessageId();
      const request = { id, method, params };

      const timeoutId = setTimeout(() => {
        this.messageHandlers.delete(id);
        reject(new Error(`Timeout waiting for response to ${method}`));
      }, timeout);

      this.messageHandlers.set(id, (response) => {
        clearTimeout(timeoutId);
        this.messageHandlers.delete(id);

        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.result);
        }
      });

      this.ws.send(JSON.stringify(request));
    });
  }

  /**
   * Stream chat with AI agent
   */
  async streamChat(
    messages: Array<{role: 'user' | 'assistant', content: string}>,
    model: string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = generateMessageId();
      let hasStarted = false;
      let timeoutId: NodeJS.Timeout;

      // Function to reset the timeout on each activity
      const resetTimeout = () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          this.messageHandlers.delete(id);
          reject(new Error('Timeout waiting for chat stream'));
        }, 60000); // 60 second timeout of inactivity
      };

      // Set initial timeout
      resetTimeout();

      this.messageHandlers.set(id, (response) => {
        if (response.error) {
          clearTimeout(timeoutId);
          this.messageHandlers.delete(id);
          reject(new Error(response.error));
          return;
        }

        if (response.type === 'start') {
          hasStarted = true;
          resetTimeout(); // Reset timeout when stream starts
        } else if (response.type === 'chunk') {
          if (response.data) {
            onChunk(response.data);
          }
          resetTimeout(); // Reset timeout on each chunk
        } else if (response.type === 'keepalive') {
          // Keep-alive ping from server - reset timeout but don't call onChunk
          resetTimeout();
        } else if (response.type === 'done') {
          clearTimeout(timeoutId);
          this.messageHandlers.delete(id);
          resolve();
        }
      });

      this.ws.send(JSON.stringify({
        id,
        method: 'streamChat',
        params: { messages, model },
      }));
    });
  }

  // ========== Space Methods ==========

  async getOrCreateSpace(name?: string) {
    return this.call('getOrCreateSpace', { name });
  }

  async updateSpaceMetadata(metadata: Record<string, any>) {
    return this.call('updateSpaceMetadata', { metadata });
  }

  // ========== Chat Methods ==========

  async createChat(name?: string, metadata?: Record<string, any>, position?: number, model?: string) {
    return this.call('createChat', { name, metadata, position, model });
  }

  async getChats(limit?: number, offset?: number) {
    return this.call('getChats', { limit, offset });
  }

  async getChat(chatId: string) {
    return this.call('getChat', { chatId });
  }

  async updateChatMetadata(chatId: string, metadata: Record<string, any>) {
    return this.call('updateChatMetadata', { chatId, metadata });
  }

  async updateChatPosition(chatId: string, position: number) {
    return this.call('updateChatPosition', { chatId, position });
  }

  async deleteChat(chatId: string) {
    return this.call('deleteChat', { chatId });
  }

  async getChatCount() {
    return this.call('getChatCount');
  }

  // ========== Message Methods ==========

  async addMessage(chatId: string, content: string, role: 'user' | 'assistant' | 'system', metadata?: Record<string, any>) {
    return this.call('addMessage', { chatId, content, role, metadata });
  }

  async getMessages(chatId: string, limit?: number, offset?: number) {
    return this.call('getMessages', { chatId, limit, offset });
  }

  async getMessage(messageId: string) {
    return this.call('getMessage', { messageId });
  }

  async deleteMessage(messageId: string) {
    return this.call('deleteMessage', { messageId });
  }

  async getMessageCount(chatId: string) {
    return this.call('getMessageCount', { chatId });
  }

  async clearMessages(chatId: string) {
    return this.call('clearMessages', { chatId });
  }

  /**
   * Close the WebSocket connection
   */
  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance per space
const clients = new Map<string, WebSocketClient>();

export async function getWebSocketClient(spaceId: string): Promise<WebSocketClient> {
  let client = clients.get(spaceId);

  if (!client) {
    client = new WebSocketClient(spaceId);
    await client.connect();
    clients.set(spaceId, client);
  } else if (!client.isConnected()) {
    await client.connect();
  }

  return client;
}

export function closeWebSocketClient(spaceId: string) {
  const client = clients.get(spaceId);
  if (client) {
    client.close();
    clients.delete(spaceId);
  }
}

/**
 * Registry WebSocket Client for managing all spaces
 */
export class RegistryWebSocketClient {
  private ws: WebSocket | null = null;
  private messageHandlers = new Map<string, (response: any) => void>();
  private messageIdCounter = 0;

  private generateId(): string {
    return `registry-${++this.messageIdCounter}-${Date.now()}`;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${WS_URL}/registry/ws`;
      console.log('Connecting to Registry WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Registry WebSocket connected');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('Registry WebSocket error:', error);
        reject(new Error('Registry WebSocket connection error'));
      };

      this.ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          const handler = this.messageHandlers.get(response.id);
          if (handler) {
            handler(response);
          }
        } catch (error) {
          console.error('Error parsing registry WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Registry WebSocket closed');
      };
    });
  }

  private async call(method: string, params?: any, timeout: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Registry WebSocket not connected'));
        return;
      }

      const id = this.generateId();
      const request = { id, method, params };

      const timeoutId = setTimeout(() => {
        this.messageHandlers.delete(id);
        reject(new Error(`Timeout waiting for response to ${method}`));
      }, timeout);

      this.messageHandlers.set(id, (response) => {
        clearTimeout(timeoutId);
        this.messageHandlers.delete(id);

        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.result);
        }
      });

      this.ws.send(JSON.stringify(request));
    });
  }

  async registerSpace(spaceId: string, name: string, userId?: string) {
    return this.call('registerSpace', { spaceId, name, userId });
  }

  async getSpaces(userId?: string) {
    return this.call('getSpaces', { userId });
  }

  async updateSpaceName(spaceId: string, name: string) {
    return this.call('updateSpaceName', { spaceId, name });
  }

  async unregisterSpace(spaceId: string) {
    return this.call('unregisterSpace', { spaceId });
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton registry client
let registryClient: RegistryWebSocketClient | null = null;

export async function getRegistryClient(): Promise<RegistryWebSocketClient> {
  if (!registryClient) {
    registryClient = new RegistryWebSocketClient();
    await registryClient.connect();
  } else if (!registryClient.isConnected()) {
    await registryClient.connect();
  }

  return registryClient;
}
