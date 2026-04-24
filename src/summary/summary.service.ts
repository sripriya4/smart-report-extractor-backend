import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SummaryService {
  private readonly groqApiKey = process.env.GROQ_API_KEY;
  private readonly groqBaseUrl = 'https://api.groq.com/openai/v1/chat/completions';

  async summarize(text: string): Promise<string> {
    try {
      if (!this.groqApiKey) {
        return 'Summary service not configured (GROQ_API_KEY not set)';
      }

      const truncatedText = text.substring(0, 3000);

      const response = await axios.post(
        this.groqBaseUrl,
        {
          model: 'llama-3.1-8b-instant',
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
            Authorization: `Bearer ${this.groqApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.choices[0].message.content || 'No summary generated';
    } catch (error) {
      if (error instanceof Object && 'response' in error) {
        const err = error as any;
        throw new HttpException(
          `Groq API Error: ${err.response?.data?.error?.message || 'Unknown error'}`,
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
