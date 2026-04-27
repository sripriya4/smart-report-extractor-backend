import { Injectable } from '@nestjs/common';
import axios from 'axios';

export interface StructuredExtraction {
  fields: Record<string, string | null>;
  summary: string;
}

@Injectable()
export class SummaryService {
  private readonly groqApiKey = process.env.GROQ_API_KEY;
  private readonly groqBaseUrl = 'https://api.groq.com/openai/v1/chat/completions';

  async extractStructured(text: string): Promise<StructuredExtraction> {
    const fallback: StructuredExtraction = { fields: {}, summary: 'Could not generate summary.' };

    if (!this.groqApiKey) {
      return { fields: {}, summary: 'Summary service not configured (GROQ_API_KEY not set).' };
    }

    try {
      const response = await axios.post(
        this.groqBaseUrl,
        {
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content:
                'You are a document analysis assistant. Given document text, return ONLY a valid JSON object with two keys: ' +
                '"fields": an object of 3-8 key-value string pairs for the most important structured data found ' +
                '(dates, names, IDs, amounts, parties, reference numbers — use null for missing values), and ' +
                '"summary": a 2-3 sentence plain-English summary. No markdown, no code blocks, no explanation.',
            },
            {
              role: 'user',
              content: `Analyze this document:\n\n${text.substring(0, 3000)}`,
            },
          ],
          max_tokens: 400,
          temperature: 0.2,
        },
        {
          headers: {
            Authorization: `Bearer ${this.groqApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const raw: string = response.data.choices[0].message.content || '';
      const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const parsed = JSON.parse(jsonStr);

      return {
        fields: parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : {},
        summary: typeof parsed.summary === 'string' ? parsed.summary : 'No summary generated.',
      };
    } catch {
      return fallback;
    }
  }
}
