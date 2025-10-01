import { proxy } from 'valtio'
import { v4 as uuidv4 } from 'uuid'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
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
  emptySpaceModels: ['claude-opus-4-1-20250805'] // Default to array with one model
})

export const actions = {
  // Space actions
  createSpace: (name: string): Space => {
    const space: Space = {
      id: uuidv4(),
      name,
      chats: {},
      chatOrder: [],
      createdAt: Date.now()
    }
    store.spaces[space.id] = space
    store.spaceOrder.push(space.id)
    store.activeSpaceId = space.id
    store.activeChatId = null // Clear active chat since no chats exist yet

    return space
  },

  setActiveSpace: (spaceId: string) => {
    store.activeSpaceId = spaceId
    const space = store.spaces[spaceId]
    if (space && space.chatOrder.length > 0) {
      store.activeChatId = space.chatOrder[0]
    } else {
      store.activeChatId = null
    }
  },

  removeSpace: (spaceId: string): void => {
    if (!store.spaces[spaceId]) throw new Error('Space not found')

    // Find index in order array
    const spaceIndex = store.spaceOrder.indexOf(spaceId)

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

  renameSpace: (spaceId: string, newName: string): void => {
    const space = store.spaces[spaceId]
    if (!space) throw new Error('Space not found')

    // Trim the name and ensure it's not empty
    const trimmedName = newName.trim()
    if (!trimmedName) throw new Error('Space name cannot be empty')

    space.name = trimmedName
  },

  // Chat actions
  createChat: (spaceId: string, title: string = 'New Chat'): Chat => {
    const chatId = uuidv4()
    console.log('Creating chat in space:', spaceId, chatId)
    const space = store.spaces[spaceId]
    if (!space) throw new Error('Space not found')

    const chat: Chat = {
      id: chatId,
      title,
      messages: [],
      isLoading: false,
      input: '',
      streamingMessageId: null,
      createdAt: Date.now(),
      model: 'claude-opus-4-1-20250805'
    }

    space.chats[chatId] = chat
    space.chatOrder.push(chatId)
    store.activeChatId = chat.id
    return chat
  },

  setActiveChat: (chatId: string) => {
    store.activeChatId = chatId
  },

  branchChat: (chatId: string): Chat => {
    const sourceChat = actions.findChat(chatId)
    if (!sourceChat) throw new Error('Source chat not found')

    // Find space containing this chat
    let space: Space | undefined
    for (const spaceId of store.spaceOrder) {
      if (store.spaces[spaceId].chats[chatId]) {
        space = store.spaces[spaceId]
        break
      }
    }
    if (!space) throw new Error('Space not found')

    // Clone the chat with new ID and title
    const branchedChat: Chat = {
      id: uuidv4(),
      title: sourceChat.title + ' (Branch)',
      messages: [...sourceChat.messages.map(msg => ({ ...msg, id: uuidv4() }))],
      isLoading: false,
      input: '',
      streamingMessageId: null,
      createdAt: Date.now(),
      model: sourceChat.model // Keep the same model as the source
    }

    // Find the index of the source chat and insert the branch right after it
    const sourceIndex = space.chatOrder.indexOf(chatId)
    space.chats[branchedChat.id] = branchedChat
    space.chatOrder.splice(sourceIndex + 1, 0, branchedChat.id)

    // Set the branched chat as active
    store.activeChatId = branchedChat.id
    return branchedChat
  },

  removeChat: (chatId: string): void => {
    // Find space containing this chat
    let space: Space | undefined
    for (const spaceId of store.spaceOrder) {
      if (store.spaces[spaceId].chats[chatId]) {
        space = store.spaces[spaceId]
        break
      }
    }
    if (!space) throw new Error('Space not found')

    const chatIndex = space.chatOrder.indexOf(chatId)
    if (chatIndex === -1) throw new Error('Chat not found')

    // Remove the chat
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
    store.emptySpaceModels = models.length > 0 ? models : ['claude-opus-4-1-20250805']
  },

  clearEmptySpaceState: () => {
    store.emptySpaceInput = ''
    store.emptySpaceModels = ['claude-opus-4-1-20250805']
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
  }
}