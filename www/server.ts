import express from 'express';
import cors from 'cors';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { Agent, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = express();
const port = 3001;

const anthropic = createAnthropic({
  apiKey: process.env.VITE_ANTHROPIC_API_KEY,
});

const openai = createOpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY,
});

interface SearchResult {
  position: number;
  title: string;
  link: string;
  snippet: string;
}

interface AnswerBox {
  answer: string;
  title: string;
  link: string;
}

interface WebSearchResults {
  searchTerm: string;
  results: SearchResult[];
  answerBox: AnswerBox | null;
  peopleAlsoAsk: string[];
  relatedSearches: string[];
}

interface SerperResponse {
  organic?: Array<{
    title: string;
    link: string;
    snippet: string;
  }>;
  answerBox?: {
    answer: string;
    title: string;
    link: string;
  };
  peopleAlsoAsk?: string[];
  relatedSearches?: string[];
}

interface WebpageContent {
  url: string;
  title: string;
  content: string;
  description?: string;
  language?: string;
  author?: string;
  publishedDate?: string;
  keywords?: string[];
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
  };
  links: Array<{
    text: string;
    url: string;
  }>;
  images: Array<{
    alt: string;
    src: string;
  }>;
  wordCount: number;
}

// Web search tool using serper.dev
const webSearchTool = tool({
  description: 'Search the web for current information, news, and answers to questions',
  inputSchema: z.object({
    query: z.string().describe('The search query to execute'),
    num: z.number().optional().default(10).describe('Number of search results to return (default: 10)'),
  }),
  execute: async ({ query, num = 10 }: { query: string; num?: number }): Promise<WebSearchResults> => {
    console.log(`🔍 Web search: "${query}" (${num} results)`);

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Search API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as SerperResponse;

      const results: WebSearchResults = {
        searchTerm: query,
        results: data.organic?.map((result, index) => ({
          position: index + 1,
          title: result.title,
          link: result.link,
          snippet: result.snippet,
        })) || [],
        answerBox: data.answerBox ? {
          answer: data.answerBox.answer,
          title: data.answerBox.title,
          link: data.answerBox.link,
        } : null,
        peopleAlsoAsk: data.peopleAlsoAsk?.slice(0, 3) || [],
        relatedSearches: data.relatedSearches?.slice(0, 5) || [],
      };

      console.log(`✓ Found ${results.results.length} results`);
      return results;
    } catch (error) {
      console.error(`✗ Web search failed: ${(error as Error).message}`);
      throw new Error(`Failed to perform web search: ${(error as Error).message}`);
    }
  },
});

// Visit webpage tool for content retrieval
const visitWebpageTool = tool({
  description: 'Visit a webpage and retrieve its content, including text, headings, links, and metadata',
  inputSchema: z.object({
    url: z.string().url().describe('The URL of the webpage to visit'),
    maxLength: z.number().optional().default(10000).describe('Maximum content length to extract (default: 10000 characters)'),
  }),
  execute: async ({ url, maxLength = 10000 }: { url: string; maxLength?: number }): Promise<WebpageContent> => {
    console.log(`🌐 Visiting: ${url}`);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WebpageVisitor/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Parse HTML with Cheerio
      const $ = cheerio.load(html);

      // Extract title
      const title = $('title').text().trim() || $('h1').first().text().trim() || 'No title found';

      // Extract meta description
      const description = $('meta[name="description"]').attr('content') ||
                         $('meta[property="og:description"]').attr('content') ||
                         undefined;

      // Extract language
      const language = $('html').attr('lang') ||
                      $('meta[http-equiv="content-language"]').attr('content') ||
                      undefined;

      // Extract author
      const author = $('meta[name="author"]').attr('content') ||
                    $('meta[property="article:author"]').attr('content') ||
                    undefined;

      // Extract published date
      const publishedDate = $('meta[property="article:published_time"]').attr('content') ||
                           $('meta[name="date"]').attr('content') ||
                           $('time[datetime]').attr('datetime') ||
                           undefined;

      // Extract keywords
      const keywordsContent = $('meta[name="keywords"]').attr('content');
      const keywords = keywordsContent ? keywordsContent.split(',').map(k => k.trim()) : [];

      // Extract headings
      const headings = {
        h1: $('h1').map((_, el) => $(el).text().trim()).get(),
        h2: $('h2').map((_, el) => $(el).text().trim()).get(),
        h3: $('h3').map((_, el) => $(el).text().trim()).get(),
      };

      // Extract links
      const links = $('a[href]').map((_, el) => {
        const $el = $(el);
        const href = $el.attr('href');
        const text = $el.text().trim();
        if (href && text) {
          try {
            const linkUrl = new URL(href, url).toString();
            return { text, url: linkUrl };
          } catch {
            return null;
          }
        }
        return null;
      }).get().filter(Boolean).slice(0, 20); // Limit to 20 links

      // Extract images
      const images = $('img[src]').map((_, el) => {
        const $el = $(el);
        const src = $el.attr('src');
        const alt = $el.attr('alt') || '';
        if (src) {
          try {
            const imageUrl = new URL(src, url).toString();
            return { alt, src: imageUrl };
          } catch {
            return null;
          }
        }
        return null;
      }).get().filter(Boolean).slice(0, 10); // Limit to 10 images

      // Extract main content
      // Remove script and style elements
      $('script, style, nav, header, footer, aside, .nav, .navigation, .menu, .sidebar, .ad, .ads, .advertisement').remove();

      // Try to find main content area
      let contentElement = $('main, article, .content, .post, .article, #content, #main, .main').first();
      if (contentElement.length === 0) {
        contentElement = $('body');
      }

      const rawContent = contentElement.text()
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

      // Truncate content if needed
      const content = rawContent.length > maxLength
        ? rawContent.substring(0, maxLength) + '...'
        : rawContent;

      const wordCount = content.split(/\s+/).length;

      const result: WebpageContent = {
        url,
        title,
        content,
        description,
        language,
        author,
        publishedDate,
        keywords,
        headings,
        links,
        images,
        wordCount,
      };

      console.log(`✓ Extracted ${wordCount} words from "${title}"`);
      return result;
    } catch (error) {
      console.error(`✗ Visit failed: ${(error as Error).message}`);
      throw new Error(`Failed to visit webpage: ${(error as Error).message}`);
    }
  },
});

app.use(cors());
app.use(express.json());

import type { ModelMessage, Tool } from 'ai';

interface ChatRequest {
  messages: ModelMessage[];
  model: string;
}

app.post('/api/chat', async (req: express.Request<{}, {}, ChatRequest>, res: express.Response) => {
  try {
    console.log('--- New /api/chat request ---');
    const { messages, model } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!model) {
      return res.status(400).json({ error: 'Model is required' });
    }

    console.log(`💬 Chat stream: ${model} (${messages.length} messages)`);

    // Determine which provider to use based on model name
    let modelProvider;
    if (model.startsWith('claude-')) {
      modelProvider = anthropic(model);
    } else if (model.startsWith('gpt-') || model.startsWith('o1-') || model.startsWith('o3-')) {
      modelProvider = openai(model);
    } else {
      return res.status(400).json({ error: 'Unsupported model' });
    }

    // Create agent on the fly
    const agent = new Agent({
      model: modelProvider,
      system: 'You are a helpful AI assistant with access to web search and webpage content retrieval.',
      tools: {
        webSearch: webSearchTool,
        visitWebpage: visitWebpageTool,
      },
      stopWhen: stepCountIs(10), // Allow up to 10 steps
    });

    // Set headers for streaming
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    try {
      // Use agent.stream for streaming responses with automatic tool calling
      const stream = agent.stream({
        messages: messages,
      });

      for await (const chunk of stream.textStream) {
        res.write(chunk);
        if ('flush' in res && typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      }

      res.end();
    } catch (streamError) {
      console.error(`✗ Stream error: ${(streamError as Error).message}`);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Streaming failed: ' + (streamError as Error).message }));
      } else {
        res.end();
      }
      throw streamError;
    }

  } catch (error) {
    let errorMessage = 'Failed to get response from AI model';

    const err = error as any;
    if (err.data?.error?.message) {
      errorMessage = err.data.error.message;
    } else if (err.responseBody) {
      try {
        const errorData = JSON.parse(err.responseBody);
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch {}
    } else if (err.message) {
      errorMessage = err.message;
    }

    console.error(`✗ Chat error: ${errorMessage}`);
    res.status(500).json({ error: errorMessage });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});