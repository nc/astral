# AI Tools Implementation

This app now supports multiple AI tools using AI SDK Core tool calling functionality.

## Available Tools

### 1. Web Search Tool
Search the web for current information using the serper.dev API.

**Setup:**
1. Get a free API key from [serper.dev](https://serper.dev/)
2. Add your API key to `.env.local`:
   ```
   SERPER_API_KEY=your_actual_api_key_here
   ```

**Usage Examples:**
- "What's the latest news about AI?"
- "What's the current stock price of Tesla?"
- "What's the weather like in San Francisco today?"

### 2. Visit Webpage Tool
Retrieve and analyze content from any webpage URL.

**Features:**
- Extracts page title, content, and metadata
- Identifies headings (H1, H2, H3)
- Collects links and images
- Extracts author, publication date, keywords
- Configurable content length limits
- Smart content area detection

**Usage Examples:**
- "What's the main content of this article: https://example.com/article"
- "Summarize this blog post: https://blog.example.com/post"
- "What are the key points from this documentation: https://docs.example.com"

## How it works

- The AI models (Claude and GPT) can automatically choose which tools to use based on the user's query
- Web search for current information and general queries
- Webpage visit for analyzing specific URLs or articles
- Results are structured and optimized for AI processing

## Technical Details

- Built with AI SDK Core's `tool` function and Zod schema validation
- Web search uses serper.dev API with comprehensive result formatting
- Webpage tool uses Cheerio for HTML parsing and content extraction
- Comprehensive logging for debugging with 🔍 and 🌐 prefixes
- TypeScript implementation with full type safety
- Error handling for network failures and invalid content

## Models Supported

Both Anthropic Claude and OpenAI GPT models that support tool calling can use these features automatically.