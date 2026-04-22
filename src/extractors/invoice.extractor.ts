import { Extractor } from './extractor.interface';

export class InvoiceExtractor implements Extractor {
  canHandle(text: string): boolean {
    return text.toLowerCase().includes('invoice');
  }

  extract(text: string) {
    const invoiceNumber = text.match(/invoice\s*(?:number|no\.?|#)?\s*[:\-]?\s*([A-Z0-9\-]+)/i);
    const total = text.match(/(?:total|amount|sum)\s*[:\-]?\s*\$?\s*([\d,]+\.?\d*)/i);
    const date = text.match(/(?:date|issued)\s*[:\-]?\s*([\d\/\-]+)/i);

    return {
      type: 'invoice',
      invoiceNumber: invoiceNumber?.[1] || null,
      total: total?.[1] || null,
      date: date?.[1] || null,
    };
  }
}
