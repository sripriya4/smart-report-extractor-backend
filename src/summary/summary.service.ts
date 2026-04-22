import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SummaryService {
  private readonly openaiApiKey = process.env.OPENAI_API_KEY;
  private readonly openaiBaseUrl = 'https://api.openai.com/v1/chat/completions';

  async summarize(text: string): Promise<string> {
    try {
      if (!this.openaiApiKey) {
        return 'Summary service not configured (OPENAI_API_KEY not set)';
      }

      // Limit text to avoid token limits
      const truncatedText = text.substring(0, 3000);

      const response = await axios.post(
        this.openaiBaseUrl,
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'You are a document summarization assistant. Provide a concise 2-3 line summary of the document text provided.',
            },
            {
              role: 'user',
              content: `Please summarize this document:\n\n${truncatedText}`,
            },
          ],
          max_tokens: 150,
          temperature: 0.5,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.choices[0].message.content || 'No summary generated';
    } catch (error) {
      if (error instanceof Object && 'response' in error) {
        const err = error as any;
        throw new HttpException(
          `OpenAI API Error: ${err.response?.data?.error?.message || 'Unknown error'}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        `Failed to generate summary: ${errorMessage}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
