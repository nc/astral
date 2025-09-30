import express from 'express';
import cors from 'cors';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
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
    console.log('🔍 [WEB SEARCH] Starting web search...');
    console.log('🔍 [WEB SEARCH] Query:', query);
    console.log('🔍 [WEB SEARCH] Number of results requested:', num);
    console.log('🔍 [WEB SEARCH] API Key present:', !!process.env.SERPER_API_KEY);
    console.log('🔍 [WEB SEARCH] API Key length:', process.env.SERPER_API_KEY?.length || 0);

    try {
      const requestBody = {
        q: query,
        num: num,
      };

      console.log('🔍 [WEB SEARCH] Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('🔍 [WEB SEARCH] Response status:', response.status);
      console.log('🔍 [WEB SEARCH] Response status text:', response.statusText);
      console.log('🔍 [WEB SEARCH] Response headers:', Object.fromEntries([...response.headers]));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 [WEB SEARCH] Error response body:', errorText);
        throw new Error(`Search API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as SerperResponse;
      console.log('🔍 [WEB SEARCH] Raw API response:', JSON.stringify(data, null, 2));

      // Format the search results for the AI model
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

      console.log('🔍 [WEB SEARCH] Formatted results:', JSON.stringify(results, null, 2));
      console.log('🔍 [WEB SEARCH] Number of organic results found:', results.results.length);
      console.log('🔍 [WEB SEARCH] Answer box present:', !!results.answerBox);
      console.log('🔍 [WEB SEARCH] Web search completed successfully');

      return results;
    } catch (error) {
      console.error('🔍 [WEB SEARCH] ERROR occurred:');
      console.error('🔍 [WEB SEARCH] Error type:', (error as Error).constructor.name);
      console.error('🔍 [WEB SEARCH] Error message:', (error as Error).message);
      console.error('🔍 [WEB SEARCH] Error stack:', (error as Error).stack);
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
    console.log('🌐 [VISIT WEBPAGE] Starting webpage visit...');
    console.log('🌐 [VISIT WEBPAGE] URL:', url);
    console.log('🌐 [VISIT WEBPAGE] Max content length:', maxLength);

    try {
      // Validate URL
      const urlObj = new URL(url);
      console.log('🌐 [VISIT WEBPAGE] Validated URL:', urlObj.toString());

      // Fetch the webpage
      console.log('🌐 [VISIT WEBPAGE] Fetching webpage...');
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WebpageVisitor/1.0; +https://example.com/bot)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
      });

      console.log('🌐 [VISIT WEBPAGE] Response status:', response.status);
      console.log('🌐 [VISIT WEBPAGE] Response status text:', response.statusText);
      console.log('🌐 [VISIT WEBPAGE] Response content type:', response.headers.get('content-type'));

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      console.log('🌐 [VISIT WEBPAGE] HTML content length:', html.length);

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

      console.log('🌐 [VISIT WEBPAGE] Extracted content:');
      console.log('🌐 [VISIT WEBPAGE] - Title:', title);
      console.log('🌐 [VISIT WEBPAGE] - Content length:', content.length);
      console.log('🌐 [VISIT WEBPAGE] - Word count:', wordCount);
      console.log('🌐 [VISIT WEBPAGE] - Headings H1:', headings.h1.length);
      console.log('🌐 [VISIT WEBPAGE] - Headings H2:', headings.h2.length);
      console.log('🌐 [VISIT WEBPAGE] - Links found:', links.length);
      console.log('🌐 [VISIT WEBPAGE] - Images found:', images.length);
      console.log('🌐 [VISIT WEBPAGE] Webpage visit completed successfully');

      return result;

    } catch (error) {
      console.error('🌐 [VISIT WEBPAGE] ERROR occurred:');
      console.error('🌐 [VISIT WEBPAGE] Error type:', (error as Error).constructor.name);
      console.error('🌐 [VISIT WEBPAGE] Error message:', (error as Error).message);
      console.error('🌐 [VISIT WEBPAGE] Error stack:', (error as Error).stack);
      throw new Error(`Failed to visit webpage: ${(error as Error).message}`);
    }
  },
});

app.use(cors());
app.use(express.json());

import type { ModelMessage } from 'ai';
import { generateText } from 'ai';

interface ChatRequest {
  messages: ModelMessage[];
  model: string;
}

app.post('/api/chat', async (req: express.Request<{}, {}, ChatRequest>, res: express.Response) => {
  try {
    const { messages, model } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!model) {
      return res.status(400).json({ error: 'Model is required' });
    }

    console.log('Starting stream for messages:', messages.length, 'messages');
    console.log('First few messages:', messages.slice(0, 3));

    console.log('Using model:', model);

    // Determine which provider to use based on model name
    let modelProvider;
    if (model.startsWith('claude-')) {
      modelProvider = anthropic(model);
    } else if (model.startsWith('gpt-') || model.startsWith('o1-') || model.startsWith('o3-')) {
      modelProvider = openai(model);
    } else {
      return res.status(400).json({ error: 'Unsupported model' });
    }

    console.log('🚀 [STREAM] About to use streamText with maxToolRoundtrips...');

    // Set headers for streaming
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    console.log('📡 [STREAM] Headers set, starting streamText with automatic tool calling...');

    try {
      // Use streamText with tools - AI SDK v5 handles multi-step automatically
      const result = await streamText({
        model: modelProvider,
        messages: messages,
        tools: {
          webSearch: webSearchTool,
          visitWebpage: visitWebpageTool,
        },
        onFinish: async ({ toolCalls, toolResults, text, finishReason }) => {
          console.log('🎯 [ON_FINISH] Generation completed!');
          console.log('🔧 [ON_FINISH] Tool calls made:', toolCalls?.length || 0);
          console.log('🔧 [ON_FINISH] Tool results:', toolResults?.length || 0);
          console.log('📄 [ON_FINISH] Final text length:', text.length);
          console.log('🏁 [ON_FINISH] Finish reason:', finishReason);

          // Log tool call details
          if (toolCalls && toolCalls.length > 0) {
            toolCalls.forEach((call, index) => {
              console.log(`🔧 [TOOL_CALL_${index}] Tool: ${call.toolName}, ID: ${call.toolCallId}`);
            });
          }

          // Log tool result details - be safe about accessing properties
          if (toolResults && toolResults.length > 0) {
            toolResults.forEach((result, index) => {
              try {
                console.log(`📊 [TOOL_RESULT_${index}] Tool: ${result.toolName}`);
                console.log(`📊 [TOOL_RESULT_${index}] Result type:`, typeof result);
                console.log(`📊 [TOOL_RESULT_${index}] Result keys:`, Object.keys(result));

                // Try different ways to access the result data
                if ('result' in result) {
                  console.log(`📊 [TOOL_RESULT_${index}] Result length:`, JSON.stringify((result as any).result).length);
                } else if ('value' in result) {
                  console.log(`📊 [TOOL_RESULT_${index}] Value length:`, JSON.stringify((result as any).value).length);
                } else {
                  console.log(`📊 [TOOL_RESULT_${index}] Full result:`, JSON.stringify(result).substring(0, 200) + '...');
                }
              } catch (error) {
                console.log(`📊 [TOOL_RESULT_${index}] Error logging result:`, (error as Error).message);
              }
            });
          }
        }
      });

      console.log('✅ [STREAM] StreamText result created, starting to stream...');

      let chunkCount = 0;
      let totalText = '';

      // Stream the response as it comes - this includes text after tool calls
      for await (const textPart of result.textStream) {
        chunkCount++;
        totalText += textPart;

        console.log(`[STREAM_CHUNK_${chunkCount}] Length: ${textPart.length}, Content: "${textPart.substring(0, 100)}${textPart.length > 100 ? '...' : ''}"`);

        res.write(textPart);

        // Force flush for better streaming UX
        if ('flush' in res && typeof (res as any).flush === 'function') {
          (res as any).flush();
        }

        console.log(`[SENT_TO_CLIENT] Chunk ${chunkCount} sent successfully`);
      }

      console.log(`🎉 [STREAM_COMPLETE] Total chunks: ${chunkCount}, Final text length: ${totalText.length}`);

      // Wait for the final result to get complete information
      const finalResult = await result;
      console.log('🔍 [FINAL_RESULT] Final reason:', finalResult.finishReason);
      console.log('🔍 [FINAL_RESULT] Usage:', finalResult.usage);

      res.end();

    } catch (streamError) {
      console.error('🚨 [STREAM_ERROR] Error during streaming:', streamError);
      console.error('🚨 [STREAM_ERROR] Error details:', {
        message: (streamError as Error).message,
        stack: (streamError as Error).stack,
        data: (streamError as any).data
      });

      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Streaming failed: ' + (streamError as Error).message }));
      } else {
        res.end();
      }
      throw streamError;
    }

  } catch (error) {
    console.error('=== MAIN ERROR HANDLER ===');
    console.error('Error calling AI API:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', (error as Error).constructor.name);
    console.error('Error keys:', Object.keys(error as object));
    console.error('Error data:', (error as any).data);
    console.error('Error message:', (error as Error).message);
    console.error('Error stack:', (error as Error).stack);
    if ((error as any).cause) console.error('Error cause:', (error as any).cause);
    if ((error as any).responseBody) console.error('Error responseBody:', (error as any).responseBody);

    let errorMessage = 'Failed to get response from AI model';

    // Check multiple possible error structures
    const err = error as any;
    if (err.data && err.data.error && err.data.error.message) {
      // AI SDK error format: error.data.error.message
      errorMessage = err.data.error.message;
    } else if (err.responseBody) {
      try {
        const errorData = JSON.parse(err.responseBody);
        if (errorData.error && errorData.error.message) {
          errorMessage = errorData.error.message;
        }
      } catch (parseError) {
        console.log('Could not parse error response body');
      }
    } else if (err.message) {
      errorMessage = err.message;
    }

    console.log('=== SENDING ERROR TO CLIENT ===');
    console.log('Final error message:', errorMessage);
    console.log('Response status will be 500');
    const errorResponse = { error: errorMessage };
    console.log('Error response object:', errorResponse);
    res.status(500).json(errorResponse);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});