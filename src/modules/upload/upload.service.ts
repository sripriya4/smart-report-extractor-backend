import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import type { Multer } from 'multer';
import { InvoiceExtractor } from '../../extractors/invoice.extractor';
import { BankExtractor } from '../../extractors/bank.extractor';
import { SummaryService } from '../../summary/summary.service';

@Injectable()
export class UploadService {
  private extractors = [
    new InvoiceExtractor(),
    new BankExtractor(),
  ];

  constructor(private readonly summaryService: SummaryService) {}

  async processFile(file: Multer.File) {
    try {
      // Parse PDF and extract text
      const pdfParseLib = (pdfParse as any).default || pdfParse;
      const data = await pdfParseLib(file.buffer);
      const text = data.text || '';

      if (!text || text.trim().length === 0) {
        return {
          success: false,
          message: 'No text extracted from PDF. This may be a scanned/image-based PDF that requires OCR.',
          pageCount: data.numpages || 0,
          hint: 'Try uploading a text-based PDF',
        };
      }

      // Try each extractor to see if it can handle this document
      for (const extractor of this.extractors) {
        if (extractor.canHandle(text)) {
          const extractedData = extractor.extract(text);

          // Generate summary using LLM
          const summary = await this.summaryService.summarize(text);

          return {
            success: true,
            type: extractedData.type,
            data: extractedData,
            summary,
            rawText: text.substring(0, 500), // First 500 chars for reference
          };
        }
      }

      // No extractor matched - return generic document with text
      const summary = await this.summaryService.summarize(text);
      return {
        success: true,
        type: 'generic_document',
        message: 'Document parsed but type not recognized. Returning full text.',
        fullText: text,
        summary,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new InternalServerErrorException(
        `Error processing PDF: ${errorMessage}`,
      );
    }
  }
}
