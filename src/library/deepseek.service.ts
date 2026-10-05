import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/chat/completions';
import * as crypto from 'crypto';
import { SettingsService } from '../settings/settings.service';
import { 
  ARTICLE_SUMMARY_PROMPT, 
  QUESTION_ANALYSIS_PROMPT_EN, 
  QUESTION_ANALYSIS_PROMPT_AR,
  SUBMISSION_ANALYSIS_PROMPT_EN,
  SUBMISSION_ANALYSIS_PROMPT_AR,
  SYSTEM_PROMPT_EN,
  SYSTEM_PROMPT_AR,
} from './prompts/medical-tutor.prompts';

export type ThinkingMode = 'non-thinking' | 'thinking' | 'thinking_max';
export type ReasoningEffort = 'high' | 'max';

export interface DeepSeekRequestOptions {
  thinkingMode?: ThinkingMode;
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
  maxTokens?: number;
}

export interface DeepSeekResponse {
  content: string;
  reasoningContent?: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    reasoningTokens?: number;
    totalTokens: number;
  };
  latencyMs: number;
}

export interface QuestionContext {
  questionText: string;
  options: Array<{
    letter: string;
    text: string;
    isCorrect: boolean;
    chosenByPercent?: number | null;
    optionExplanation?: string | null;
  }>;
  subject?: string;
  system?: string;
  topic?: string;
  globalAccuracyRate?: number;
}

@Injectable()
export class DeepSeekService {
  private readonly logger = new Logger(DeepSeekService.name);
  private client: OpenAI;
  
  // Rate limiting
  private lastCallTime = 0;
  private minDelayMs = 100;

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    const baseURL = this.configService.get<string>('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com/v1';
    
    if (!apiKey) {
      this.logger.error('DEEPSEEK_API_KEY is not configured');
      throw new Error('DEEPSEEK_API_KEY is required');
    }

    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
      timeout: 30000, // 30 second timeout
      maxRetries: 2,  // Automatic retries on failure
    });
  }

  /**
   * Internal: Maps thinking mode to API parameters
   */
  private getThinkingParams(thinkingMode: ThinkingMode, reasoningEffort?: ReasoningEffort) {
    switch (thinkingMode) {
      case 'non-thinking':
        return {
          thinking: { type: 'disabled' },
          reasoning_effort: undefined,
        };
      case 'thinking':
        return {
          thinking: { type: 'enabled' },
          reasoning_effort: reasoningEffort || 'high',
        };
      case 'thinking_max':
        return {
          thinking: { type: 'enabled' },
          reasoning_effort: 'max',
        };
      default:
        return {
          thinking: { type: 'enabled' },
          reasoning_effort: 'high',
        };
    }
  }

  /**
   * Internal: Enhanced HTML cleaning for medical content
   */
  private cleanHtml(html: string, maxLen = 10000): string {
    if (!html) return '';
    
    let cleaned = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n\n')
      .replace(/<li\b[^>]*>/gi, '• ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleaned.length > maxLen ? cleaned.substring(0, maxLen) + '...' : cleaned;
  }

  /**
   * Internal: Protect against rapid API calls
   */
  private async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastCallTime;
    if (elapsed < this.minDelayMs) {
      await new Promise(resolve => setTimeout(resolve, this.minDelayMs - elapsed));
    }
    this.lastCallTime = Date.now();
  }

  /**
   * Internal: Basic response validation
   */
  private validateAnalysisResponse(content: string): boolean {
    if (!content || content.length < 20) {
      this.logger.warn(`Validation failed: content length=${content?.length || 0}, first 100 chars: "${(content || '').substring(0, 100)}"`);
      return false;
    }
    
    const failurePatterns = [
      /^I'm sorry/i,
      /^I cannot/i,
      /^As an AI/i,
    ];
    
    return !failurePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Internal: Cache key generation is no longer used - relying on DB persistence.
   */

  // --- Business Methods ---

  /**
   * Generates a comprehensive summary for an entire article.
   */
  async generateArticleSummary(
    articleTitle: string,
    articleContent: string,
  ): Promise<string> {
    const plainText = this.cleanHtml(articleContent, 12000);
    const prompt = ARTICLE_SUMMARY_PROMPT
      .replace(/%TITLE%/g, articleTitle)
      .replace('%CONTENT%', plainText);

    try {
      const response = await this.callDeepSeekFlash(prompt, { maxTokens: 4096 });
      
      if (!this.validateAnalysisResponse(response.content)) {
        this.logger.warn('Invalid AI article summary detected');
        throw new Error('Failed to generate valid analysis');
      }
      
      return response.content;
    } catch (error) {
      this.logger.error(`Article Summary Error: ${error.message}`);
      throw new InternalServerErrorException('Failed to generate AI article summary.');
    }
  }

  /**
   * Backwards compatible name for generateArticleSummary
   */
  async analyzeFullArticle(title: string, content: string) {
    return this.generateArticleSummary(title, content);
  }

  /**
   * Generates a focused breakdown of a test question.
   */
  async generateQuestionAnalysis(ctx: QuestionContext, language: 'en' | 'ar' = 'en'): Promise<string> {
    const cleanQuestion = this.cleanHtml(ctx.questionText);
    const optionsBlock = ctx.options
      .map(o => `${o.letter}. ${this.cleanHtml(o.text, 2000)}${o.isCorrect ? ' ✅ CORRECT' : ''}${o.chosenByPercent != null ? ` [chosen by ${o.chosenByPercent}%]` : ""}`)
      .join("\n");

    const correctOption = ctx.options.find(o => o.isCorrect);
    const correctAnswer = correctOption
      ? `${correctOption.letter}. ${this.cleanHtml(correctOption.text, 2000)}`
      : 'Not specified';

    const metaLines: string[] = [];
    if (ctx.subject) metaLines.push(`Subject: ${ctx.subject}`);
    if (ctx.system) metaLines.push(`System: ${ctx.system}`);
    if (ctx.topic) metaLines.push(`Topic: ${ctx.topic}`);

    const promptTemplate = language === 'ar' ? QUESTION_ANALYSIS_PROMPT_AR : QUESTION_ANALYSIS_PROMPT_EN;
    const systemPrompt = language === 'ar' ? SYSTEM_PROMPT_AR : SYSTEM_PROMPT_EN;

    const prompt = promptTemplate
      .replace('%METADATA%', metaLines.length > 0 ? `**Metadata:** ${metaLines.join(", ")}` : "")
      .replace('%STEM%', cleanQuestion)
      .replace('%OPTIONS%', optionsBlock)
      .replace('%CORRECT_ANSWER%', correctAnswer);

    try {
      const response = await this.callDeepSeekPro(prompt, { thinkingMode: 'non-thinking', maxTokens: 4096 }, systemPrompt);
      
      if (!response.content || response.content.length < 20) {
        this.logger.error(`AI returned empty/short content. content.length=${response.content?.length || 0}, reasoningContent.length=${response.reasoningContent?.length || 0}`);
        throw new Error('AI model returned empty content — likely ran out of token budget during reasoning');
      }

      if (!this.validateAnalysisResponse(response.content)) {
        this.logger.warn('Invalid AI question analysis detected');
        throw new Error('Failed to generate valid analysis');
      }

      return response.content;
    } catch (error) {
      this.logger.error(`Question Analysis Error: ${error.message}`);
      throw new InternalServerErrorException('Failed to generate AI question analysis.');
    }
  }

  /**
   * Generates a personalized explanation after submission.
   */
  async generateSubmissionAnalysis(
    ctx: QuestionContext,
    explanationText: string,
    selectedOptionLetter: string,
    selectedOptionText: string,
    isCorrect: boolean,
    language: 'en' | 'ar' = 'en',
  ): Promise<string> {
    const cleanQuestion = this.cleanHtml(ctx.questionText);
    const cleanExplanation = this.cleanHtml(explanationText, 6000);
    const cleanSelected = this.cleanHtml(selectedOptionText, 2000);

    const correctOption = ctx.options.find(o => o.isCorrect);
    const correctLetter = correctOption?.letter || "?";
    const correctText = correctOption ? this.cleanHtml(correctOption.text, 2000) : "";

    // Find the chosen option's explanation
    const selectedOption = ctx.options.find(o => o.letter === selectedOptionLetter);
    const chosenOptionExplanation = selectedOption?.optionExplanation
      ? this.cleanHtml(selectedOption.optionExplanation, 3000)
      : 'No specific explanation available for this option.';

    const allOptionsBlock = ctx.options
      .map(o => {
        const markers: string[] = [];
        if (o.isCorrect) markers.push("✅ CORRECT");
        if (o.letter === selectedOptionLetter) markers.push("👤 Student's choice");
        const markerStr = markers.length > 0 ? ` [${markers.join(" | ")}]` : "";
        return `${o.letter}. ${this.cleanHtml(o.text, 2000)}${markerStr}`;
      })
      .join("\n\n");

    const promptTemplate = language === 'ar' ? SUBMISSION_ANALYSIS_PROMPT_AR : SUBMISSION_ANALYSIS_PROMPT_EN;
    const systemPrompt = language === 'ar' ? SYSTEM_PROMPT_AR : SYSTEM_PROMPT_EN;

    const statusText = language === 'ar'
      ? (isCorrect ? 'صحيح ✅' : 'غلط ❌')
      : (isCorrect ? 'CORRECT ✅' : 'INCORRECT ❌');

    const headerText = language === 'ar'
      ? (isCorrect ? '**🎉 أحسنت يا دكتور!**' : '**💡 تعال نتعلم من الغلطة دي**')
      : (isCorrect ? '**🎉 Great Job!**' : '**💡 Let\'s Learn From This**');

    const introText = language === 'ar'
      ? (isCorrect ? 'اعتراف بليه ده أحسن اختيار.' : 'نقدّر تفكيرك، بس تعال نشوف الفرق الدقيق.')
      : (isCorrect ? 'Acknowledgment of why this is the best answer.' : 'Validate student thinking, then explain the critical distinction.');

    const prompt = promptTemplate
      .replace('%SELECTED_LETTER%', selectedOptionLetter)
      .replace(/%STATUS%/g, statusText)
      .replace('%STEM%', cleanQuestion)
      .replace('%OPTIONS_BLOCK%', allOptionsBlock)
      .replace('%EXPLANATION%', cleanExplanation)
      .replace('%SELECTED_TEXT%', cleanSelected)
      .replace('%CORRECT_INFO%', !isCorrect ? `**Correct Answer:** ${correctLetter}. ${correctText}` : "")
      .replace('%HEADER%', headerText)
      .replace('%INTRO%', introText)
      .replace('%CHOSEN_OPTION_EXPLANATION%', chosenOptionExplanation)
      .replace('%LAST_LETTER%', ctx.options[ctx.options.length - 1]?.letter || "E");

    try {
      const response = await this.callDeepSeekPro(prompt, { thinkingMode: 'non-thinking', maxTokens: 4096 }, systemPrompt);
      
      if (!response.content || response.content.length < 20) {
        this.logger.error(`AI returned empty/short content. content.length=${response.content?.length || 0}, reasoningContent.length=${response.reasoningContent?.length || 0}`);
        throw new Error('AI model returned empty content — likely ran out of token budget during reasoning');
      }

      if (!this.validateAnalysisResponse(response.content)) {
        this.logger.warn('Invalid AI submission analysis detected');
        throw new Error('Failed to generate valid analysis');
      }

      return response.content;
    } catch (error) {
      this.logger.error(`Submission Analysis Error: ${error.message}`);
      throw new InternalServerErrorException('Failed to generate AI submission analysis.');
    }
  }

  // --- Low-level API Callers ---

  /**
   * Calls the high-reasoning Pro model (deepseek-v4-pro)
   */
  async callDeepSeekPro(
    prompt: string,
    options: DeepSeekRequestOptions = {},
    systemPromptOverride?: string,
  ): Promise<DeepSeekResponse> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    const {
      thinkingMode = 'thinking',
      reasoningEffort = 'high',
      temperature = 1.0,
      maxTokens = 4096,
    } = options;

    await this.rateLimit();
    this.logger.debug(`[${requestId}] Starting DeepSeek Pro API call`);

    // Read model and thinking mode from admin settings (cached 60s)
    const [modelSetting, thinkingModeSetting] = await Promise.all([
      this.settingsService.getString('AI_MODEL', 'flash'),
      this.settingsService.getString('AI_THINKING_MODE', 'non-thinking'),
    ]);
    const modelName = modelSetting === 'pro' ? 'deepseek-v4-pro' : 'deepseek-v4-flash';
    const effectiveThinking = (thinkingModeSetting === 'thinking' ? 'thinking' : 'non-thinking') as ThinkingMode;
    const thinkingParams = this.getThinkingParams(effectiveThinking, reasoningEffort);

    this.logger.debug(`[${requestId}] model=${modelName}, thinking=${effectiveThinking}`);

    const systemContent = systemPromptOverride || `You are a medical tutor for USMLE and MRCP exams. 
                      Analyze the following medical question step by step.
                      Provide reasoning in your thinking process, then give a clear final answer.`;

    try {
      const completion = await this.client.chat.completions.create({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: systemContent,
          },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
        reasoning_effort: thinkingParams.reasoning_effort,
        thinking: thinkingParams.thinking, // Top-level as requested
      } as any as ChatCompletionCreateParamsNonStreaming);

      const latencyMs = Date.now() - startTime;
      const message = completion.choices[0].message;
      const content = message.content || '';

      if (!content && !(message as any).reasoning_content) {
        this.logger.warn(`[${requestId}] Empty response from DeepSeek API`);
        throw new Error('Empty response from AI service');
      }

      const result: DeepSeekResponse = {
        content,
        reasoningContent: (message as any).reasoning_content,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          reasoningTokens: (completion.usage as any)?.reasoning_tokens,
          totalTokens: completion.usage?.total_tokens || 0,
        },
        latencyMs,
      };

      this.logger.debug(`[${requestId}] Completed in ${latencyMs}ms`);

      return result;
    } catch (error) {
      this.logger.error(`[${requestId}] Pro API error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Backwards compatible name
   */
  async analyzeQuestion(q: string, o: DeepSeekRequestOptions = {}) {
    return this.callDeepSeekPro(q, o);
  }

  /**
   * Calls the lightweight Flash model (deepseek-v4-flash)
   */
  async callDeepSeekFlash(
    prompt: string,
    options: DeepSeekRequestOptions = {},
  ): Promise<DeepSeekResponse> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    const { thinkingMode = 'non-thinking', temperature = 1.0, maxTokens = 1024 } = options;

    await this.rateLimit();

    const thinkingParams = this.getThinkingParams(thinkingMode);

    try {
      const completion = await this.client.chat.completions.create({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: 'You are a medical assistant. Provide concise, accurate answers.' },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
        reasoning_effort: thinkingParams.reasoning_effort,
        thinking: thinkingParams.thinking,
      } as any as ChatCompletionCreateParamsNonStreaming);

      const content = completion.choices[0].message.content || '';
      if (!content && !(completion.choices[0].message as any).reasoning_content) {
        throw new Error('Empty response from AI service');
      }

      const result: DeepSeekResponse = {
        content,
        reasoningContent: (completion.choices[0].message as any).reasoning_content,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
        latencyMs: Date.now() - startTime,
      };

      return result;
    } catch (error) {
      this.logger.error(`[${requestId}] Flash API error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Backwards compatible name
   */
  async quickAnalysis(p: string, o: DeepSeekRequestOptions = {}) {
    return this.callDeepSeekFlash(p, o);
  }

  /**
   * Multi-turn conversation with thinking mode
   */
  async continueConversation(
    messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
      reasoning_content?: string;
    }>,
    options: DeepSeekRequestOptions = {},
  ): Promise<DeepSeekResponse> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    const { thinkingMode = 'thinking', reasoningEffort = 'high', temperature = 1.0 } = options;

    await this.rateLimit();

    const thinkingParams = this.getThinkingParams(thinkingMode, reasoningEffort);

    const formattedMessages = messages.map((msg) => {
      const baseMessage: any = { role: msg.role, content: msg.content };
      if (msg.role === 'assistant' && msg.reasoning_content) {
        baseMessage.reasoning_content = msg.reasoning_content;
      }
      return baseMessage;
    });

    try {
      const completion = await this.client.chat.completions.create({
        model: 'deepseek-v4-pro',
        messages: formattedMessages,
        temperature,
        reasoning_effort: thinkingParams.reasoning_effort,
        thinking: thinkingParams.thinking,
      } as any as ChatCompletionCreateParamsNonStreaming);

      const message = completion.choices[0].message;
      const content = message.content || '';

      return {
        content,
        reasoningContent: (message as any).reasoning_content,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`[${requestId}] Conversation error: ${error.message}`);
      throw error;
    }
  }
}
