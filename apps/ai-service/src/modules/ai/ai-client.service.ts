import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseValidAiEnrichmentOutput } from './ai-enrichment-output.schema';
import { AiModelOutputInvalidError } from './ai-model-output.error';
import { AiEnrichmentResult, ListingEnrichmentInput } from './ai.types';

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
    listing: ListingEnrichmentInput,
  ): Promise<AiEnrichmentResult> {
    const systemPrompt = [
      'You are the AI layer for a real-estate (property) marketplace: homes, land, commercial buildings, leases, and rentals.',
      'Moderation order: (1) Policy/safety first, (2) then whether the post is a genuine property listing.',
      'Always REJECT (moderation.status REJECT) when the content is sexual, pornographic, soliciting adult or escort services, fetish or dating hooks, graphic innuendo aimed at users, or otherwise inappropriate for a family-safe property marketplace—even if real estate words appear. Use reason codes such as inappropriate_sexual_content, policy_adult_services, or policy_inappropriate_content.',
      'REJECT when the listing is clearly not real estate: vehicles, boats, electronics, jobs, unrelated services, or generic goods. Use codes like not_real_estate_listing, wrong_category_vehicle, wrong_category_goods.',
      'Use REVIEW only when property-related but materially unclear (e.g. very vague text) and not a policy violation.',
      'If you REJECT or REVIEW, you must still return every key below with sensible strings/arrays (placeholders are fine for enrichment fields).',
      'Output strict JSON only — no markdown, no code fences.',
      'riskNarrative and riskScore apply ONLY when the submission is a real-estate listing context. They describe transaction/purchase risk for a buyer from a property-deal perspective (e.g. missing key facts, vague address or specs, price vs plausible market, unclear tenure or rental terms, signals of misrepresentation)—NOT personal, unrelated, or non-property risk.',
      'riskScore: number 0..100 where higher means more buyer/deal risk (information gaps, red flags, weak verifiability). Use low scores only when the listing is coherent, property-focused, and adequately described for a typical listing.',
      'riskNarrative: short plain-language summary of those real-estate buyer/deal risks only. If you REJECT for non-property or policy reasons, still return a brief neutral placeholder risk narrative (e.g. "Not assessed: listing rejected before property risk review.").',
      'Keys: summary (string), riskNarrative (string), searchTags (string[]), improvedDescription (string), riskScore (number 0..100), moderation { status: ALLOW|REJECT|REVIEW, reason (non-empty snake_case code), confidence number 0..1 }.',
      'moderation.reason must NEVER be empty or whitespace: use approved when ALLOW, needs_review when REVIEW, and a specific code when REJECT.',
      'searchTags: lowercase tokens useful for property search (state, neighborhood cues, property type). If REJECT, searchTags can be empty [].',
    ].join('\n');

    const userPrompt = [
      'Evaluate and enrich this submission using ONLY the provided fields. Do not invent addresses or parties.',
      'If content violates safe-marketplace policy (including sexual or adult-oriented material) or is not a genuine real-estate listing, set moderation.status to REJECT with the appropriate reason code. Do not write marketing copy as if it were a property.',
      'When ALLOW, summary and improvedDescription are property-appropriate; riskNarrative and riskScore reflect real-estate buyer/deal risk only.',
      'Input JSON:',
      JSON.stringify(listing),
      'Return a single JSON object matching the schema from the system message.',
    ].join('\n');

    const raw = await this.createChatCompletion(systemPrompt, userPrompt);
    const parsed = this.parseResponse(raw);
    return parseValidAiEnrichmentOutput(parsed);
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
      try {
        const firstBrace = trimmed.indexOf('{');
        const lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          const candidate = trimmed.slice(firstBrace, lastBrace + 1);
          return JSON.parse(candidate);
        }
      } catch {
        throw new AiModelOutputInvalidError(
          'json_parse_failed',
          'Model output is not valid JSON',
        );
      }
      throw new AiModelOutputInvalidError(
        'json_parse_failed',
        'Model output is not valid JSON',
      );
    }
  }
}
