# Astral

A modern, multi-space chat application powered by Claude and GPT models, built with Cloudflare Durable Objects and React.

## Features

### 🌌 Multi-Space Architecture
- **Spaces**: Organize your conversations into separate workspaces
- **Multiple Chats**: Create unlimited chats within each space
- **Branching**: Fork conversations to explore different paths
- **Chat Ordering**: Drag and drop to reorder chats

### 🤖 AI Models
- **Claude Models**: Sonnet 4.5, Opus 4.1, Sonnet 4, Haiku 3.5, Opus 3
- **GPT Models**: GPT-5, GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo, o1-preview, o1-mini
- **Model Switching**: Select different models per chat
- **Streaming Responses**: Real-time streaming of AI responses

### 🔧 AI Agent Capabilities
- **Web Search**: Integrated search powered by Serper API
- **Web Scraping**: Visit and extract content from webpages
- **Tool Use**: Agents can use tools to gather information

### 💬 Chat Features
- **Message Actions**: Copy, branch, share, and regenerate messages
- **Markdown Support**: Full markdown rendering with syntax highlighting
- **Code Blocks**: Beautiful syntax highlighting for code
- **Tables**: GitHub-flavored markdown table support
- **Real-time Updates**: Live streaming of AI responses

### 🔗 Sharing
- **Public Sharing**: Share chat snapshots via URL
- **No Authentication Required**: Anyone with the link can view shared chats
- **Snapshot-based**: Shared chats are frozen in time

### 🔐 Authentication
- **Google OAuth**: Sign in with Google
- **User Isolation**: Each user's spaces are isolated
- **Session Management**: Persistent authentication

## Architecture

### Frontend (`/www`)
- **React** with TypeScript
- **Valtio** for state management
- **Radix UI** for accessible components
- **React Markdown** for markdown rendering
- **Vite** for development and building

### Backend (`/do`)
- **Cloudflare Durable Objects** for distributed state
- **SQLite** for persistent storage (built into Durable Objects)
- **WebSocket** for real-time communication
- **Vercel AI SDK** for AI model integration

### Key Durable Objects
1. **SpaceDurableObject**: Manages spaces, chats, and messages
2. **SpaceRegistryDurableObject**: Global registry of all spaces
3. **UserDurableObject**: User authentication and profile management

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Cloudflare account (for deployment)

### Environment Variables

Create a `.dev.vars` file in the `/do` directory:

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
SERPER_API_KEY=your_serper_api_key
GCP_OAUTH_CLIENT_ID=your_google_oauth_client_id
GCP_OAUTH_CLIENT_SECRET=your_google_oauth_client_secret
```

Create a `.env` file in the `/www` directory:

```bash
VITE_BACKEND_URL=http://localhost:8787
```

### Installation

1. **Install backend dependencies:**
```bash
cd do
npm install
```

2. **Install frontend dependencies:**
```bash
cd www
npm install
```

### Development

1. **Start the backend (Cloudflare Workers):**
```bash
cd do
npm run dev
```

The backend will start on `http://localhost:8787`

2. **Start the frontend (Vite):**
```bash
cd www
npm run dev
```

The frontend will start on `http://localhost:5173`

### Building for Production

1. **Build the frontend:**
```bash
cd www
npm run build
```

2. **Deploy to Cloudflare:**
```bash
cd do
npx wrangler deploy
```

## Project Structure

```
astral/
├── do/                          # Backend (Cloudflare Durable Objects)
│   ├── src/
│   │   └── index.ts            # Main worker and Durable Objects
│   ├── wrangler.toml           # Cloudflare configuration
│   └── package.json
│
├── www/                         # Frontend (React)
│   ├── src/
│   │   ├── App.tsx             # Main app component
│   │   ├── store.ts            # Valtio state management
│   │   ├── api.ts              # API functions
│   │   ├── websocket-client.ts # WebSocket client
│   │   ├── Chat.tsx            # Chat component
│   │   ├── ChatComposer.tsx    # Message input component
│   │   ├── MessageActions.tsx  # Message action buttons
│   │   ├── ShareDialog.tsx     # Share dialog component
│   │   ├── SharedChat.tsx      # Public shared chat viewer
│   │   ├── Space.tsx           # Space component
│   │   ├── SpacesList.tsx      # Sidebar with spaces
│   │   └── SignIn.tsx          # Sign in page
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
└── shared-types.ts             # Shared TypeScript types
```

## Database Schema

### Spaces Table
```sql
CREATE TABLE spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  metadata TEXT
)
```

### Chats Table
```sql
CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  position REAL NOT NULL DEFAULT 0,
  model TEXT,
  metadata TEXT,
  FOREIGN KEY (space_id) REFERENCES spaces(id)
)
```

### Messages Table
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  content TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  timestamp INTEGER NOT NULL,
  metadata TEXT,
  FOREIGN KEY (chat_id) REFERENCES chats(id)
)
```

### Shared Chats Table
```sql
CREATE TABLE shared_chats (
  share_id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  chat_name TEXT NOT NULL,
  model TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id)
)
```

### Space Registry Table
```sql
CREATE TABLE space_registry (
  space_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  user_id TEXT
)
```

## API Endpoints

### WebSocket
- `ws://localhost:8787/spaces/:spaceId/ws` - Space WebSocket connection
- `ws://localhost:8787/registry/ws` - Registry WebSocket connection
- `ws://localhost:8787/user/:userId/ws` - User WebSocket connection

### HTTP
- `GET /api/share/:shareId` - Get shared chat data
- `GET /auth/callback` - OAuth callback handler

## WebSocket Methods

### Space Methods
- `getOrCreateSpace({ name })` - Get or create a space
- `updateSpaceMetadata({ metadata })` - Update space metadata

### Chat Methods
- `createChat({ name, metadata, position, model })` - Create a new chat
- `getChats({ limit, offset })` - Get all chats in a space
- `getChat({ chatId })` - Get a specific chat
- `updateChatMetadata({ chatId, metadata })` - Update chat metadata
- `updateChatPosition({ chatId, position })` - Update chat position
- `deleteChat({ chatId })` - Delete a chat
- `getChatCount()` - Get total chat count
- `shareChat({ chatId })` - Create a shareable link

### Message Methods
- `addMessage({ chatId, content, role, metadata })` - Add a message
- `getMessages({ chatId, limit, offset })` - Get messages for a chat
- `getMessage({ messageId })` - Get a specific message
- `deleteMessage({ messageId })` - Delete a message
- `getMessageCount({ chatId })` - Get message count
- `clearMessages({ chatId })` - Clear all messages
- `streamChat({ messages, model })` - Stream AI response

### Registry Methods
- `registerSpace({ spaceId, name, userId })` - Register a space
- `getSpaces({ userId })` - Get all spaces for a user
- `updateSpaceName({ spaceId, name })` - Update space name
- `unregisterSpace({ spaceId })` - Unregister a space

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Acknowledgments

- Built with [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- AI powered by [Anthropic Claude](https://www.anthropic.com/) and [OpenAI](https://openai.com/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Search powered by [Serper](https://serper.dev/)
