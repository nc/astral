import { proxy } from 'valtio'
import { v4 as uuidv4 } from 'uuid'
import { getWebSocketClient, getRegistryClient } from './websocket-client'
import { z } from 'zod'

// Zod schemas for backend data validation
const BackendSpaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
  metadata: z.record(z.any()).optional(),
})

const BackendChatSchema = z.object({
  id: z.string(),
  spaceId: z.string().optional(),
  name: z.string(),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
  position: z.number(),
  metadata: z.record(z.any()).optional(),
  model: z.string().optional(),
})

const BackendMessageSchema = z.object({
  id: z.string(),
  chatId: z.string().optional(),
  content: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  timestamp: z.number(),
  metadata: z.record(z.any()).optional(),
  toolCall: z.object({
    toolName: z.string(),
    args: z.record(z.any()).optional().nullable()
  }).optional().nullable(),
  toolResult: z.object({
    toolName: z.string(),
    result: z.any().optional().nullable()
  }).optional().nullable(),
})

const BackendSpacesArraySchema = z.array(BackendSpaceSchema)
const BackendChatsArraySchema = z.array(BackendChatSchema)
const BackendMessagesArraySchema = z.array(BackendMessageSchema)

export interface ToolCall {
  toolName: string
  args: Record<string, any>
}

export interface ToolResult {
  toolName: string
  result: any
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  toolCall?: ToolCall
  toolResult?: ToolResult
}

export interface UserMessage {
  id: string
  role: 'user'
  content: string
  timestamp: number
  toolResult?: ToolResult
}

export interface AssistantMessage {
  id: string
  role: 'assistant'
  content: string
  timestamp: number
  toolCall?: ToolCall
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  isLoading: boolean
  input: string
  streamingMessageId: string | null
  createdAt: number
  model: string | null // null means not selected yet
}

export interface Space {
  id: string
  name: string
  chats: Record<string, Chat>
  chatOrder: string[] // Track order of chats
  createdAt: number
}

export interface AppState {
  spaces: Record<string, Space>
  spaceOrder: string[] // Track order of spaces
  activeSpaceId: string | null
  activeChatId: string | null
  sidebarVisible: boolean
  chatComposerHeight: number
  chatHeaderHeight: number
  // Temporary state for empty space
  emptySpaceInput: string
  emptySpaceModels: string[] // Changed to array for multi-selection
  // Default model for new chats and spaces
  defaultModel: string
  // Current user ID (for authentication)
  currentUserId: string | null
  // Theme
  theme: string
}

export const store = proxy<AppState>({
  spaces: {},
  spaceOrder: [],
  activeSpaceId: null,
  activeChatId: null,
  sidebarVisible: true,
  chatComposerHeight: 104, // Default height
  chatHeaderHeight: 56, // Default height
  emptySpaceInput: '',
  emptySpaceModels: ['claude-sonnet-4-5-20250929'], // Default to array with one model
  defaultModel: 'claude-sonnet-4-5-20250929',
  currentUserId: null,
  theme: localStorage.getItem('theme') || 'astral-dark'
})

export const actions = {
  // Initialization
  init: async (userId?: string): Promise<void> => {
    console.log('Initializing app from backend...', userId ? `for user ${userId}` : '');

    // Store current user ID
    if (userId) {
      store.currentUserId = userId;
    }

    try {
      let spacesToLoad: Array<{ id: string; name: string; createdAt: number }> = [];

      const registry = await getRegistryClient();

      if (userId) {
        // Get user's spaces from registry filtered by userId
        const rawSpaces = await registry.getSpaces(userId);
        const spaces = BackendSpacesArraySchema.parse(rawSpaces);
        spacesToLoad = spaces;
      } else {
        // Load all spaces (for backwards compatibility / no auth mode)
        const rawSpaces = await registry.getSpaces();
        const spaces = BackendSpacesArraySchema.parse(rawSpaces);
        spacesToLoad = spaces;
      }

      console.log(`Loaded ${spacesToLoad.length} spaces:`, spacesToLoad);

      // Load all spaces and their chats
      for (const spaceData of spacesToLoad) {
        if (!store.spaces[spaceData.id]) {
          console.log(`Loading space: ${spaceData.name} (${spaceData.id})`);
          // Create space in local store
          const space: Space = {
            id: spaceData.id,
            name: spaceData.name,
            chats: {},
            chatOrder: [],
            createdAt: spaceData.createdAt
          };
          store.spaces[space.id] = space;
          store.spaceOrder.push(space.id);

          // Load chats for this space
          try {
            const client = await getWebSocketClient(spaceData.id);
            const rawChats = await client.getChats();

            // Validate chats data
            const backendChats = BackendChatsArraySchema.parse(rawChats);
            console.log(`  Loaded ${backendChats.length} chats for space ${spaceData.id}`);

            // Backend returns chats ordered by position ASC, so we can add them in order
            for (const backendChat of backendChats) {
              console.log(`    Chat: ${backendChat.name} (${backendChat.id}) at position ${backendChat.position}`);

              // Load messages for this chat
              const rawMessages = await client.getMessages(backendChat.id);

              // Validate messages data
              const backendMessages = BackendMessagesArraySchema.parse(rawMessages);
              console.log(`      Loaded ${backendMessages.length} messages`);
              console.log('      Raw messages:', rawMessages);
              console.log('      Parsed messages:', backendMessages);

              const messages = backendMessages.map(msg => ({
                id: msg.id,
                role: msg.role as 'user' | 'assistant',
                content: msg.content,
                timestamp: msg.timestamp,
                toolCall: (msg.toolCall?.args ? msg.toolCall : undefined) as ToolCall | undefined,
                toolResult: (msg.toolResult?.result !== null && msg.toolResult?.result !== undefined ? msg.toolResult : undefined) as ToolResult | undefined
              }));

              space.chats[backendChat.id] = {
                id: backendChat.id,
                title: backendChat.name,
                messages: messages,
                isLoading: false,
                input: '',
                streamingMessageId: null,
                createdAt: backendChat.createdAt,
                model: backendChat.model || store.defaultModel
              };
              space.chatOrder.push(backendChat.id);
            }
          } catch (error) {
            console.error(`Failed to load chats for space ${spaceData.id}:`, error);
          }
        }
      }

      // Set first space as active if none is active
      if (!store.activeSpaceId && store.spaceOrder.length > 0) {
        console.log(`Setting active space to: ${store.spaceOrder[0]}`);
        await actions.setActiveSpace(store.spaceOrder[0]);
      }
      console.log('Initialization complete');
    } catch (error) {
      console.error('Failed to initialize from backend:', error);
    }
  },

  // Space actions
  createSpace: async (name: string): Promise<Space> => {
    // Create space locally first for immediate UI feedback
    const spaceId = uuidv4();
    const space: Space = {
      id: spaceId,
      name,
      chats: {},
      chatOrder: [],
      createdAt: Date.now()
    }
    store.spaces[space.id] = space
    store.spaceOrder.unshift(space.id) // Prepend to start (newest first)
    store.activeSpaceId = space.id
    store.activeChatId = null

    // Sync with backend
    try {
      const client = await getWebSocketClient(spaceId);
      const rawSpace = await client.getOrCreateSpace(name);

      // Validate space data
      const backendSpace = BackendSpaceSchema.parse(rawSpace);

      // Update with backend data
      space.createdAt = backendSpace.createdAt;

      // Register space in registry with current user ID
      const registry = await getRegistryClient();
      await registry.registerSpace(spaceId, name, store.currentUserId || undefined);
    } catch (error) {
      console.error('Failed to sync space with backend:', error);
      if (error instanceof z.ZodError) {
        console.error('Validation errors:', error.errors);
      }
    }

    return space
  },

  setActiveSpace: async (spaceId: string) => {
    store.activeSpaceId = spaceId
    const space = store.spaces[spaceId]

    // Load chats from backend
    try {
      const client = await getWebSocketClient(spaceId);
      const rawChats = await client.getChats();

      // Validate chats data
      const backendChats = BackendChatsArraySchema.parse(rawChats);

      // Sync backend chats with local store (backend returns ordered by position ASC)
      const backendChatIds = new Set(backendChats.map(c => c.id));

      // Remove chats that no longer exist in backend
      space.chatOrder = space.chatOrder.filter(id => backendChatIds.has(id));

      // Add or update chats from backend
      for (const backendChat of backendChats) {
        if (!space.chats[backendChat.id]) {
          // Load messages for this chat
          const rawMessages = await client.getMessages(backendChat.id);

          // Validate messages data
          const backendMessages = BackendMessagesArraySchema.parse(rawMessages);
          console.log(`  Loaded ${backendMessages.length} messages for chat ${backendChat.id}`);

          const messages = backendMessages.map(msg => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: msg.timestamp,
            toolCall: (msg.toolCall?.args ? msg.toolCall : undefined) as ToolCall | undefined,
            toolResult: (msg.toolResult?.result !== null && msg.toolResult?.result !== undefined ? msg.toolResult : undefined) as ToolResult | undefined
          }));

          // Add new chat with messages
          space.chats[backendChat.id] = {
            id: backendChat.id,
            title: backendChat.name,
            messages: messages,
            isLoading: false,
            input: '',
            streamingMessageId: null,
            createdAt: backendChat.createdAt,
            model: backendChat.model || store.defaultModel
          };
        }
      }

      // Rebuild chatOrder based on backend position order
      space.chatOrder = backendChats.map(chat => chat.id);
    } catch (error) {
      console.error('Failed to load chats from backend:', error);
    }

    if (space && space.chatOrder.length > 0) {
      await actions.setActiveChat(space.chatOrder[0])
    } else {
      store.activeChatId = null
    }
  },

  removeSpace: async (spaceId: string): Promise<void> => {
    if (!store.spaces[spaceId]) throw new Error('Space not found')

    // Find index in order array
    const spaceIndex = store.spaceOrder.indexOf(spaceId)

    // Unregister from backend
    try {
      const registry = await getRegistryClient();
      await registry.unregisterSpace(spaceId);
    } catch (error) {
      console.error('Failed to unregister space from backend:', error);
    }

    // Remove the space
    delete store.spaces[spaceId]
    store.spaceOrder.splice(spaceIndex, 1)

    // If this was the active space, set a new active space
    if (store.activeSpaceId === spaceId) {
      // Try to activate the space that was after the removed one, or the previous one
      const newActiveIndex = Math.min(spaceIndex, store.spaceOrder.length - 1)
      const newActiveSpaceId = store.spaceOrder[newActiveIndex]
      if (newActiveSpaceId) {
        const newActiveSpace = store.spaces[newActiveSpaceId]
        store.activeSpaceId = newActiveSpaceId
        store.activeChatId = newActiveSpace.chatOrder[0] || null
      } else {
        store.activeSpaceId = null
        store.activeChatId = null
      }
    }
  },

  renameSpace: async (spaceId: string, newName: string): Promise<void> => {
    const space = store.spaces[spaceId]
    if (!space) throw new Error('Space not found')

    // Trim the name and ensure it's not empty
    const trimmedName = newName.trim()
    if (!trimmedName) throw new Error('Space name cannot be empty')

    // Update locally first
    space.name = trimmedName

    // Sync with backend - update both the Space DO and the Registry
    try {
      const client = await getWebSocketClient(spaceId);
      await client.updateSpaceMetadata({ name: trimmedName });

      // Also update in the Space Registry
      const registry = await getRegistryClient();
      await registry.updateSpaceName(spaceId, trimmedName);
    } catch (error) {
      console.error('Failed to sync space rename with backend:', error);
    }
  },

  // Chat actions
  createChat: async (spaceId: string, title: string = 'New Chat', insertAtPosition?: number, model?: string): Promise<Chat> => {
    console.log('Creating chat in space:', spaceId, 'at position:', insertAtPosition)
    const space = store.spaces[spaceId]
    if (!space) throw new Error('Space not found')

    // Determine position: if not specified, append to end
    const position = insertAtPosition !== undefined ? insertAtPosition : space.chatOrder.length;

    // Use provided model or default
    const chatModel = model || store.defaultModel;

    // Create chat in backend first to get the real ID
    try {
      const client = await getWebSocketClient(spaceId);
      const rawChat = await client.createChat(title, { type: 'chat' }, position, chatModel);

      // Validate chat data
      const backendChat = BackendChatSchema.parse(rawChat);

      const chat: Chat = {
        id: backendChat.id,
        title: backendChat.name,
        messages: [],
        isLoading: false,
        input: '',
        streamingMessageId: null,
        createdAt: backendChat.createdAt,
        model: backendChat.model || chatModel
      }

      space.chats[chat.id] = chat
      // Insert at the correct position in the local order
      space.chatOrder.splice(position, 0, chat.id)
      store.activeChatId = chat.id
      return chat
    } catch (error) {
      console.error('Failed to create chat in backend:', error);
      throw error;
    }
  },

  setActiveChat: async (chatId: string) => {
    store.activeChatId = chatId

    // Load messages from backend
    const spaceId = store.activeSpaceId;
    if (!spaceId) {
      console.log('setActiveChat: No active spaceId');
      return;
    }

    const chat = actions.findChat(chatId);
    if (!chat) {
      console.log('setActiveChat: Chat not found', chatId);
      return;
    }

    // Only load if messages are empty
    if (chat.messages.length === 0) {
      console.log(`Loading messages for chat ${chatId} in space ${spaceId}`);
      try {
        const client = await getWebSocketClient(spaceId);
        const rawMessages = await client.getMessages(chatId);

        // Validate messages data
        const backendMessages = BackendMessagesArraySchema.parse(rawMessages);
        console.log(`Loaded ${backendMessages.length} messages from backend`);

        // Convert backend messages to store format
        for (const backendMsg of backendMessages) {
          chat.messages.push({
            id: backendMsg.id,
            role: backendMsg.role as 'user' | 'assistant',
            content: backendMsg.content,
            timestamp: backendMsg.timestamp,
            toolCall: (backendMsg.toolCall?.args ? backendMsg.toolCall : undefined) as ToolCall | undefined,
            toolResult: (backendMsg.toolResult?.result !== null && backendMsg.toolResult?.result !== undefined ? backendMsg.toolResult : undefined) as ToolResult | undefined
          });
        }
      } catch (error) {
        console.error('Failed to load messages from backend:', error);
        if (error instanceof z.ZodError) {
          console.error('Validation errors:', error.errors);
        }
      }
    } else {
      console.log(`Chat ${chatId} already has ${chat.messages.length} messages loaded`);
    }
  },

  branchChat: async (chatId: string): Promise<Chat> => {
    const sourceChat = actions.findChat(chatId)
    if (!sourceChat) throw new Error('Source chat not found')

    // Find space containing this chat
    let space: Space | undefined
    let spaceId: string | undefined
    for (const sid of store.spaceOrder) {
      if (store.spaces[sid].chats[chatId]) {
        space = store.spaces[sid]
        spaceId = sid
        break
      }
    }
    if (!space || !spaceId) throw new Error('Space not found')

    // Find the index of the source chat - branch should be inserted right after
    const sourceIndex = space.chatOrder.indexOf(chatId)
    const branchPosition = sourceIndex + 1

    // Create the branched chat in backend at the correct position with the source chat's model
    const client = await getWebSocketClient(spaceId);
    const rawChat = await client.createChat(
      sourceChat.title + ' (Branch)',
      { type: 'branch', sourceChatId: chatId },
      branchPosition,
      sourceChat.model || store.defaultModel
    );

    // Validate chat data
    const backendChat = BackendChatSchema.parse(rawChat);

    // Clone the chat locally
    const branchedChat: Chat = {
      id: backendChat.id,
      title: backendChat.name,
      messages: [...sourceChat.messages.map(msg => ({ ...msg, id: uuidv4() }))],
      isLoading: false,
      input: '',
      streamingMessageId: null,
      createdAt: backendChat.createdAt,
      model: sourceChat.model
    }

    // Add to local store at correct position
    space.chats[branchedChat.id] = branchedChat
    space.chatOrder.splice(branchPosition, 0, branchedChat.id)

    // Save the cloned messages to backend
    for (const msg of branchedChat.messages) {
      try {
        await client.addMessage(branchedChat.id, msg.content, msg.role, { timestamp: msg.timestamp });
      } catch (error) {
        console.error('Failed to save branched message:', error);
      }
    }

    // Set the branched chat as active
    store.activeChatId = branchedChat.id
    return branchedChat
  },

  removeChat: async (chatId: string): Promise<void> => {
    // Find space containing this chat
    let space: Space | undefined
    let spaceId: string | undefined
    for (const sid of store.spaceOrder) {
      if (store.spaces[sid].chats[chatId]) {
        space = store.spaces[sid]
        spaceId = sid
        break
      }
    }
    if (!space || !spaceId) throw new Error('Space not found')

    const chatIndex = space.chatOrder.indexOf(chatId)
    if (chatIndex === -1) throw new Error('Chat not found')

    // Delete from backend first
    try {
      const client = await getWebSocketClient(spaceId);
      await client.deleteChat(chatId);
      console.log(`Chat ${chatId} deleted from backend`);
    } catch (error) {
      console.error('Failed to delete chat from backend:', error);
      // Continue with local deletion even if backend fails
    }

    // Remove the chat locally
    delete space.chats[chatId]
    space.chatOrder.splice(chatIndex, 1)

    // If this was the active chat, set a new active chat
    if (store.activeChatId === chatId) {
      // Try to activate the chat that was after the removed one, or the previous one
      const newActiveIndex = Math.min(chatIndex, space.chatOrder.length - 1)
      const newActiveChatId = space.chatOrder[newActiveIndex]
      store.activeChatId = newActiveChatId || null
    }
  },

  // Message actions for specific chat
  setInput: (chatId: string, value: string) => {
    const chat = actions.findChat(chatId)
    if (chat) chat.input = value
  },
  
  setLoading: (chatId: string, loading: boolean) => {
    const chat = actions.findChat(chatId)
    if (chat) chat.isLoading = loading
  },
  
  addMessage: (chatId: string, message: Message) => {
    const chat = actions.findChat(chatId)
    if (chat) chat.messages.push(message)
  },
  
  clearInput: (chatId: string) => {
    const chat = actions.findChat(chatId)
    if (chat) chat.input = ''
  },
  
  createMessage: (role: 'user' | 'assistant', content: string): Message => ({
    id: uuidv4(),
    role,
    content,
    timestamp: Date.now()
  }),

  createUserMessage: (content: string): UserMessage => ({
    id: uuidv4(),
    role: 'user',
    content,
    timestamp: Date.now()
  }),

  createAssistantMessage: (content: string): AssistantMessage => ({
    id: uuidv4(),
    role: 'assistant',
    content,
    timestamp: Date.now()
  }),

  setStreamingMessageId: (chatId: string, id: string | null) => {
    const chat = actions.findChat(chatId)
    if (chat) chat.streamingMessageId = id
  },

  appendToMessage: (chatId: string, messageId: string, chunk: string) => {
    const chat = actions.findChat(chatId)
    if (chat) {
      const message = chat.messages.find(m => m.id === messageId)
      if (message) {
        message.content += chunk
      }
    }
  },

  updateMessageContent: (chatId: string, messageId: string, content: string) => {
    const chat = actions.findChat(chatId)
    if (chat) {
      const message = chat.messages.find(m => m.id === messageId)
      if (message) {
        message.content = content
      }
    }
  },

  setModel: (chatId: string, model: string) => {
    const chat = actions.findChat(chatId)
    if (chat) {
      chat.model = model
    }
  },

  // UI actions
  toggleSidebar: () => {
    store.sidebarVisible = !store.sidebarVisible
  },

  setSidebarVisible: (visible: boolean) => {
    store.sidebarVisible = visible
  },

  setChatComposerHeight: (height: number) => {
    store.chatComposerHeight = height
  },

  setChatHeaderHeight: (height: number) => {
    store.chatHeaderHeight = height
  },

  // Empty space actions
  setEmptySpaceInput: (input: string) => {
    store.emptySpaceInput = input
  },

  toggleEmptySpaceModel: (model: string, shiftKey: boolean) => {
    console.log(`Store: toggleEmptySpaceModel called with model=${model}, shiftKey=${shiftKey}, currentModels=`, store.emptySpaceModels);

    if (shiftKey) {
      // Multi-select mode with Shift
      const currentModels = [...store.emptySpaceModels]
      const modelIndex = currentModels.indexOf(model)

      if (modelIndex === -1) {
        // Add model to selection
        console.log(`Store: Adding model ${model} to selection`);
        store.emptySpaceModels = [...currentModels, model]
      } else {
        // Remove model from selection, but keep at least one
        if (currentModels.length > 1) {
          console.log(`Store: Removing model ${model} from selection`);
          store.emptySpaceModels = currentModels.filter(m => m !== model)
        } else {
          console.log(`Store: Cannot remove last model ${model}`);
        }
      }
    } else {
      // Single select mode without Shift
      console.log(`Store: Single select mode, setting to [${model}]`);
      store.emptySpaceModels = [model]
    }

    console.log(`Store: New emptySpaceModels=`, store.emptySpaceModels);
  },

  setEmptySpaceModels: (models: string[]) => {
    store.emptySpaceModels = models.length > 0 ? models : [store.defaultModel]
  },

  setDefaultModel: (model: string) => {
    store.defaultModel = model
  },

  clearEmptySpaceState: () => {
    store.emptySpaceInput = ''
    store.emptySpaceModels = [store.defaultModel]
  },

  // Helper functions
  findChat: (chatId: string): Chat | undefined => {
    for (const spaceId of store.spaceOrder) {
      const chat = store.spaces[spaceId].chats[chatId]
      if (chat) return chat
    }
    return undefined
  },

  getActiveSpace: (): Space | undefined => {
    return store.activeSpaceId ? store.spaces[store.activeSpaceId] : undefined
  },

  getActiveChat: (): Chat | undefined => {
    return actions.findChat(store.activeChatId || '')
  },

  // Theme actions
  setTheme: (theme: string) => {
    store.theme = theme
    localStorage.setItem('theme', theme)
  },

  getTheme: (): string => {
    return store.theme
  }
}