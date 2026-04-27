import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import * as pdfParse from 'pdf-parse';
import { InvoiceExtractor } from '../../extractors/invoice.extractor';
import { SummaryService } from '../../summary/summary.service';

interface UploadedFile {
  mimetype: string;
  buffer: Buffer;
}

@Injectable()
export class UploadService {
  private extractors = [
    new InvoiceExtractor(),
  ];

  constructor(private readonly summaryService: SummaryService) {}

  async processFile(file: UploadedFile) {
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
          // Skip LLM for recognized types — structured fields already capture the key data
          const summary = this.buildStructuredSummary(extractedData);

          return {
            success: true,
            type: extractedData.type,
            data: extractedData,
            summary,
            rawText: text.substring(0, 500),
          };
        }
      }

      // No extractor matched — use LLM for structured extraction
      const { fields, summary } = await this.summaryService.extractStructured(text);
      return {
        success: true,
        type: 'generic_document',
        data: fields,
        summary,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isPdfFormatError = /bad xref|invalid pdf|bad pdf|unexpected token|cannot read/i.test(errorMessage);
      if (isPdfFormatError) {
        throw new BadRequestException(
          'Could not parse this PDF. The file may be corrupted, password-protected, or in an unsupported format. Try re-saving it as a standard PDF.',
        );
      }
      throw new InternalServerErrorException(`Error processing PDF: ${errorMessage}`);
    }
  }

  private buildStructuredSummary(data: any): string {
    if (data.type === 'invoice') {
      const parts = ['Invoice document.'];
      if (data.invoiceNumber) parts.push(`Invoice number: ${data.invoiceNumber}.`);
      if (data.seller) parts.push(`Seller: ${data.seller}.`);
      if (data.total) parts.push(`Total: ${data.total}.`);
      if (data.date) parts.push(`Date: ${data.date}.`);
      if (data.orderNumber) parts.push(`Order: ${data.orderNumber}.`);
      return parts.join(' ');
    }
    return 'Structured document processed successfully.';
  }
}
