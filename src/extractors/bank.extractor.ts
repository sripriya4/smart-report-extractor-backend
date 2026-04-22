import { Extractor } from './extractor.interface';

export class BankExtractor implements Extractor {
  canHandle(text: string): boolean {
    const bankKeywords = ['bank statement', 'account statement', 'balance', 'account number'];
    return bankKeywords.some(keyword => text.toLowerCase().includes(keyword));
  }

  extract(text: string) {
    const accountNumber = text.match(/(?:account\s*(?:number|no\.?|#)?|acct)\s*[:\-]?\s*([A-Z0-9\-]+)/i);
    const balance = text.match(/(?:balance|available\s+balance)\s*[:\-]?\s*\$?\s*([\d,]+\.?\d*)/i);
    const bankName = text.match(/(?:bank\s+name|from|issued\s+by)\s*[:\-]?\s*([A-Za-z\s&]+?)(?:\n|$)/i);

    return {
      type: 'bank_statement',
      accountNumber: accountNumber?.[1] || null,
      balance: balance?.[1] || null,
      bankName: bankName?.[1]?.trim() || null,
    };
  }
}
