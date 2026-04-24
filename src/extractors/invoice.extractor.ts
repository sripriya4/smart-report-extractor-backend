import { Extractor } from './extractor.interface';

const CURRENCY = '[₹$£€]?\\s*';
const AMOUNT = '([\\d,]+\\.?\\d*)';
const SEP = '\\s*[:\\-]?\\s*';

export class InvoiceExtractor implements Extractor {
  canHandle(text: string): boolean {
    return text.toLowerCase().includes('invoice');
  }

  extract(text: string) {
    return {
      type: 'invoice',
      invoiceNumber: this.extractInvoiceNumber(text),
      total: this.extractTotal(text),
      date: this.extractDate(text),
      orderNumber: this.extractOrderNumber(text),
      seller: this.extractSeller(text),
    };
  }

  private extractInvoiceNumber(text: string): string | null {
    return (
      // "Invoice Number : MKT-001" / "Invoice No. 1234" / "Invoice #INV-99"
      text.match(/invoice\s+(?:number|no\.?|#)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-\/]+)/i)?.[1] ??
      // Standalone patterns: "INV-001", "INV001", "#1234"
      text.match(/\bINV[-\/]?([A-Z0-9\-]+)/i)?.[1]?.replace(/^/, 'INV-') ??
      // Hash prefix: "#00123"
      text.match(/#\s*([A-Z0-9\-]{3,})/)?.[1] ??
      null
    );
  }

  private extractTotal(text: string): string | null {
    const patterns = [
      // Specific labels first
      new RegExp(`invoice\\s+value${SEP}${CURRENCY}${AMOUNT}`, 'i'),
      new RegExp(`amount\\s+due${SEP}${CURRENCY}${AMOUNT}`, 'i'),
      new RegExp(`balance\\s+due${SEP}${CURRENCY}${AMOUNT}`, 'i'),
      new RegExp(`amount\\s+payable${SEP}${CURRENCY}${AMOUNT}`, 'i'),
      new RegExp(`total\\s+amount${SEP}${CURRENCY}${AMOUNT}`, 'i'),
      new RegExp(`grand\\s+total${SEP}${CURRENCY}${AMOUNT}`, 'i'),
      // Generic TOTAL: — last resort, more likely to grab a subtotal
      new RegExp(`\\bTOTAL\\s*:\\s*${CURRENCY}${AMOUNT}`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  }

  private extractDate(text: string): string | null {
    const dateNum = '[\\d]{1,2}[.\\/-][\\d]{1,2}[.\\/-][\\d]{2,4}';
    const dateISO = '[\\d]{4}-[\\d]{2}-[\\d]{2}';
    const dateWords = '[A-Za-z]+ \\d{1,2},? \\d{4}';
    const any = `(?:${dateNum}|${dateISO}|${dateWords})`;

    return (
      text.match(new RegExp(`invoice\\s+date\\s*[:\\-]\\s*(${any})`, 'i'))?.[1] ??
      text.match(new RegExp(`date\\s+of\\s+issue\\s*[:\\-]\\s*(${any})`, 'i'))?.[1] ??
      text.match(new RegExp(`issued\\s*[:\\-]\\s*(${any})`, 'i'))?.[1] ??
      text.match(new RegExp(`bill\\s+date\\s*[:\\-]\\s*(${any})`, 'i'))?.[1] ??
      text.match(new RegExp(`date\\s*[:\\-]\\s*(${any})`, 'i'))?.[1] ??
      null
    );
  }

  private extractOrderNumber(text: string): string | null {
    return (
      text.match(/order\s+(?:number|no\.?|#|id)\s*[:\-]?\s*([A-Z0-9\-]+)/i)?.[1] ??
      text.match(/order\s*[:\-]\s*([A-Z0-9\-]+)/i)?.[1] ??
      null
    );
  }

  private extractSeller(text: string): string | null {
    return (
      text.match(/sold\s+by\s*[:\-]?\s*\n?\s*([^\n]+)/i)?.[1]?.trim() ??
      text.match(/(?:bill(?:ed)?\s+from|from|vendor|supplier)\s*[:\-]\s*([^\n]+)/i)?.[1]?.trim() ??
      null
    );
  }
}
