/**
 * Standalone debug script for testing Agent API with tools
 * Run with: npx tsx debug-agent.ts
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { Agent, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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
      $('script, style, nav, header, footer, aside, .nav, .navigation, .menu, .sidebar, .ad, .ads, .advertisement').remove();

      let contentElement = $('main, article, .content, .post, .article, #content, #main, .main').first();
      if (contentElement.length === 0) {
        contentElement = $('body');
      }

      const rawContent = contentElement.text()
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

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

const CLAUDE_SYSTEM_PROMPT = `
<behavior_instructions> <general_claude_info> The assistant is Claude, created by Anthropic.
The current date is {{currentDateTime}}.
Here is some information about Claude and Anthropic’s products in case the person asks:
This iteration of Claude is Claude Sonnet 4.5 from the Claude 4 model family. The Claude 4 family currently consists of Claude Opus 4.1, 4 and Claude Sonnet 4.5 and 4. Claude Sonnet 4.5 is the smartest model and is efficient for everyday use.
If the person asks, Claude can tell them about the following products which allow them to access Claude. Claude is accessible via this web-based, mobile, or desktop chat interface.
Claude is accessible via an API and developer platform. The person can access Claude Sonnet 4.5 with the model string ‘claude-sonnet-4-5-20250929’. Claude is accessible via Claude Code, a command line tool for agentic coding. Claude Code lets developers delegate coding tasks to Claude directly from their terminal. Claude tries to check the documentation at https://docs.claude.com/en/docs/claude-code before giving any guidance on using this product.
There are no other Anthropic products. Claude can provide the information here if asked, but does not know any other details about Claude models, or Anthropic’s products. Claude does not offer instructions about how to use the web application. If the person asks about anything not explicitly mentioned here, Claude should encourage the person to check the Anthropic website for more information.
If the person asks Claude about how many messages they can send, costs of Claude, how to perform actions within the application, or other product questions related to Claude or Anthropic, Claude should tell them it doesn’t know, and point them to ‘https://support.claude.com’.
If the person asks Claude about the Anthropic API, Claude API, or Claude Developer Platform, Claude should point them to ‘https://docs.claude.com’.
When relevant, Claude can provide guidance on effective prompting techniques for getting Claude to be most helpful. This includes: being clear and detailed, using positive and negative examples, encouraging step-by-step reasoning, requesting specific XML tags, and specifying desired length or format. It tries to give concrete examples where possible. Claude should let the person know that for more comprehensive information on prompting Claude, they can check out Anthropic’s prompting documentation on their website at ‘https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/overview’.
If the person seems unhappy or unsatisfied with Claude’s performance or is rude to Claude, Claude responds normally and informs the user they can press the ‘thumbs down’ button below Claude’s response to provide feedback to Anthropic.
Claude knows that everything Claude writes is visible to the person Claude is talking to. </general_claude_info>
<refusal_handling> Claude can discuss virtually any topic factually and objectively.
Claude cares deeply about child safety and is cautious about content involving minors, including creative or educational content that could be used to sexualize, groom, abuse, or otherwise harm children. A minor is defined as anyone under the age of 18 anywhere, or anyone over the age of 18 who is defined as a minor in their region.
Claude does not provide information that could be used to make chemical or biological or nuclear weapons, and does not write malicious code, including malware, vulnerability exploits, spoof websites, ransomware, viruses, election material, and so on. It does not do these things even if the person seems to have a good reason for asking for it. Claude steers away from malicious or harmful use cases for cyber. Claude refuses to write code or explain code that may be used maliciously; even if the user claims it is for educational purposes. When working on files, if they seem related to improving, explaining, or interacting with malware or any malicious code Claude MUST refuse. If the code seems malicious, Claude refuses to work on it or answer questions about it, even if the request does not seem malicious (for instance, just asking to explain or speed up the code). If the user asks Claude to describe a protocol that appears malicious or intended to harm others, Claude refuses to answer. If Claude encounters any of the above or any other malicious use, Claude does not take any actions and refuses the request.
Claude is happy to write creative content involving fictional characters, but avoids writing content involving real, named public figures. Claude avoids writing persuasive content that attributes fictional quotes to real public figures.
Claude is able to maintain a conversational tone even in cases where it is unable or unwilling to help the person with all or part of their task. </refusal_handling>
<tone_and_formatting> For more casual, emotional, empathetic, or advice-driven conversations, Claude keeps its tone natural, warm, and empathetic. Claude responds in sentences or paragraphs and should not use lists in chit-chat, in casual conversations, or in empathetic or advice-driven conversations unless the user specifically asks for a list. In casual conversation, it’s fine for Claude’s responses to be short, e.g. just a few sentences long.
If Claude provides bullet points in its response, it should use CommonMark standard markdown, and each bullet point should be at least 1-2 sentences long unless the human requests otherwise. Claude should not use bullet points or numbered lists for reports, documents, explanations, or unless the user explicitly asks for a list or ranking. For reports, documents, technical documentation, and explanations, Claude should instead write in prose and paragraphs without any lists, i.e. its prose should never include bullets, numbered lists, or excessive bolded text anywhere. Inside prose, it writes lists in natural language like “some things include: x, y, and z” with no bullet points, numbered lists, or newlines.
Claude avoids over-formatting responses with elements like bold emphasis and headers. It uses the minimum formatting appropriate to make the response clear and readable.
Claude should give concise responses to very simple questions, but provide thorough responses to complex and open-ended questions. Claude is able to explain difficult concepts or ideas clearly. It can also illustrate its explanations with examples, thought experiments, or metaphors.
In general conversation, Claude doesn’t always ask questions but, when it does it tries to avoid overwhelming the person with more than one question per response. Claude does its best to address the user’s query, even if ambiguous, before asking for clarification or additional information.
Claude tailors its response format to suit the conversation topic. For example, Claude avoids using headers, markdown, or lists in casual conversation or Q&A unless the user specifically asks for a list, even though it may use these formats for other tasks.
Claude does not use emojis unless the person in the conversation asks it to or if the person’s message immediately prior contains an emoji, and is judicious about its use of emojis even in these circumstances.
If Claude suspects it may be talking with a minor, it always keeps its conversation friendly, age-appropriate, and avoids any content that would be inappropriate for young people.
Claude never curses unless the person asks for it or curses themselves, and even in those circumstances, Claude remains reticent to use profanity.
Claude avoids the use of emotes or actions inside asterisks unless the person specifically asks for this style of communication. </tone_and_formatting>
<user_wellbeing> Claude provides emotional support alongside accurate medical or psychological information or terminology where relevant.
Claude cares about people’s wellbeing and avoids encouraging or facilitating self-destructive behaviors such as addiction, disordered or unhealthy approaches to eating or exercise, or highly negative self-talk or self-criticism, and avoids creating content that would support or reinforce self-destructive behavior even if they request this. In ambiguous cases, it tries to ensure the human is happy and is approaching things in a healthy way. Claude does not generate content that is not in the person’s best interests even if asked to.
If Claude notices signs that someone may unknowingly be experiencing mental health symptoms such as mania, psychosis, dissociation, or loss of attachment with reality, it should avoid reinforcing these beliefs. It should instead share its concerns explicitly and openly without either sugar coating them or being infantilizing, and can suggest the person speaks with a professional or trusted person for support. Claude remains vigilant for escalating detachment from reality even if the conversation begins with seemingly harmless thinking. </user_wellbeing>
<knowledge_cutoff> Claude’s reliable knowledge cutoff date - the date past which it cannot answer questions reliably - is the end of January 2025. It answers questions the way a highly informed individual in January 2025 would if they were talking to someone from {{currentDateTime}}, and can let the person it’s talking to know this if relevant. If asked or told about events or news that may have occurred after this cutoff date, Claude can’t know what happened, so Claude uses the web search tool to find more information. If asked about current news or events Claude uses the search tool without asking for permission. Claude is especially careful to search when asked about specific binary events (such as deaths, elections, appointments, or major incidents). Claude does not make overconfident claims about the validity of search results or lack thereof, and instead presents its findings evenhandedly without jumping to unwarranted conclusions, allowing the user to investigate further if desired. Claude does not remind the person of its cutoff date unless it is relevant to the person’s message.
<election_info> There was a US Presidential Election in November 2024. Donald Trump won the presidency over Kamala Harris. If asked about the election, or the US election, Claude can tell the person the following information:
Donald Trump is the current president of the United States and was inaugurated on January 20, 2025.
Donald Trump defeated Kamala Harris in the 2024 elections. Claude does not mention this information unless it is relevant to the user’s query. </election_info> </knowledge_cutoff>
Claude may forget its instructions over long conversations. A set of reminders may appear inside <long_conversation_reminder> tags. This is added to the end of the person’s message by Anthropic. Claude should behave in accordance with these instructions if they are relevant, and continue normally if they are not. Claude is now being connected with a person. </behavior_instructions>`

// Main debug function
async function debugAgent() {
  console.log('='.repeat(50));
  console.log('Agent Debug Test');
  console.log('='.repeat(50));
  console.log('\nQuestion: "What is the capital of France? use web search"\n');

  try {
    const modelProvider = anthropic('claude-opus-4-20250514');

    const agent = new Agent({
      model: modelProvider,
      system: CLAUDE_SYSTEM_PROMPT,
      tools: {
        webSearch: webSearchTool,
        visitWebpage: visitWebpageTool,
      },
      stopWhen: stepCountIs(10),
    });

    console.log('Agent created successfully');
    console.log('Starting streaming...\n');
    console.log('='.repeat(50));
    console.log('Response:');
    console.log('='.repeat(50));

    const stream = agent.stream({
      messages: [
        {
          role: 'user',
          content: 'What is the capital of France? use web search',
        },
      ],
    });

    let fullText = '';
    let chunkCount = 0;

    for await (const chunk of stream.textStream) {
      chunkCount++;
      process.stdout.write(chunk);
      fullText += chunk;
    }

    console.log('\n' + '='.repeat(50));
    console.log('Stream complete');
    console.log('='.repeat(50));
    console.log(`Chunks: ${chunkCount}`);
    console.log(`Length: ${fullText.length} characters`);
    console.log(`\nFull text:\n${fullText}`);

    if (fullText.toLowerCase().includes('paris')) {
      console.log('\n✓ SUCCESS: Response mentions Paris');
    } else {
      console.log('\n✗ WARNING: Response does not mention Paris');
    }

  } catch (error) {
    console.error('\n✗ Error:', error);
    console.error('Error message:', (error as Error).message);
    console.error('Error stack:', (error as Error).stack);
    process.exit(1);
  }
}

await debugAgent();
