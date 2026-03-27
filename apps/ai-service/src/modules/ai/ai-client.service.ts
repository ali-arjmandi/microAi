import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiEnrichmentResult } from './ai.types';

interface TransactionInput {
  transactionId?: string;
  title?: string;
  description?: string;
  propertyAddress?: string;
  state?: string;
  price?: number;
}

interface OpenRouterChoice {
  message?: {
    content?: string;
  };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
}

@Injectable()
export class AiClientService {
  private readonly logger = new Logger(AiClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateEnrichment(
    transaction: TransactionInput,
  ): Promise<AiEnrichmentResult> {
    const systemPrompt = [
      'You produce strict JSON only.',
      'Never return markdown or code fences.',
      'Output keys: summary, riskNarrative, searchTags, improvedDescription, moderation.',
      'moderation must include status (ALLOW|REJECT|REVIEW), reason, confidence [0..1].',
    ].join(' ');

    const userPrompt = [
      'Create concise enrichment for the transaction:',
      JSON.stringify(transaction),
      'Return valid JSON that matches the required keys and types.',
    ].join('\n');

    const raw = await this.createChatCompletion(systemPrompt, userPrompt);
    const parsed = this.parseResponse(raw);
    return this.validateEnrichment(parsed);
  }

  private async createChatCompletion(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    const baseUrl =
      this.configService.get<string>('OPENROUTER_BASE_URL') ??
      'https://openrouter.ai/api/v1';
    const model =
      this.configService.get<string>('OPENROUTER_MODEL') ?? 'openrouter/free';
    const timeoutMs = Number(
      this.configService.get<number>('AI_TIMEOUT_MS') ?? 12_000,
    );
    const maxRetries = Number(
      this.configService.get<number>('AI_MAX_RETRIES') ?? 2,
    );

    if (!apiKey) {
      throw new InternalServerErrorException(
        'OPENROUTER_API_KEY is missing for ai-service',
      );
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://microagent.local/ai-service',
            'X-Title': 'microAgent-ai-service',
          },
          body: JSON.stringify({
            model,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutHandle);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `OpenRouter request failed with status ${response.status}: ${errorBody}`,
          );
        }

        const data = (await response.json()) as OpenRouterResponse;
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error(
            'OpenRouter response does not include message content',
          );
        }

        return content;
      } catch (error) {
        lastError = error;
        if (attempt > maxRetries) {
          break;
        }
        this.logger.warn(
          `OpenRouter attempt ${attempt} failed; retrying (${attempt}/${maxRetries})`,
        );
      }
    }

    throw new InternalServerErrorException(
      `OpenRouter completion failed after retries: ${String(lastError)}`,
    );
  }

  private parseResponse(rawContent: string): unknown {
    const trimmed = rawContent.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        const candidate = trimmed.slice(firstBrace, lastBrace + 1);
        return JSON.parse(candidate);
      }
      throw new Error('Model output is not valid JSON');
    }
  }

  private validateEnrichment(payload: unknown): AiEnrichmentResult {
    if (!payload || typeof payload !== 'object') {
      throw new Error('AI enrichment payload must be an object');
    }

    const value = payload as Partial<AiEnrichmentResult>;
    const moderation = value.moderation as Partial<
      AiEnrichmentResult['moderation']
    >;

    if (
      typeof value.summary !== 'string' ||
      typeof value.riskNarrative !== 'string' ||
      typeof value.improvedDescription !== 'string'
    ) {
      throw new Error('AI enrichment payload contains invalid text fields');
    }

    if (!Array.isArray(value.searchTags)) {
      throw new Error('AI enrichment payload searchTags must be an array');
    }

    if (
      !moderation ||
      typeof moderation.status !== 'string' ||
      !['ALLOW', 'REJECT', 'REVIEW'].includes(moderation.status) ||
      typeof moderation.reason !== 'string' ||
      typeof moderation.confidence !== 'number'
    ) {
      throw new Error('AI enrichment payload moderation is invalid');
    }

    return {
      summary: value.summary,
      riskNarrative: value.riskNarrative,
      searchTags: value.searchTags.filter(
        (tag: unknown): tag is string =>
          typeof tag === 'string' && tag.length > 0,
      ),
      improvedDescription: value.improvedDescription,
      moderation: {
        status: moderation.status,
        reason: moderation.reason,
        confidence: Math.max(0, Math.min(1, moderation.confidence)),
      },
    };
  }
}
