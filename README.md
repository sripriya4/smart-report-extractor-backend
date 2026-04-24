# Smart Report Extractor — Backend

NestJS service that accepts a PDF upload and returns structured field extraction plus a plain-English summary. Supports invoices, bank statements, and generic documents.

## Stack

- **Runtime**: Node.js + NestJS (Express under the hood)
- **PDF parsing**: pdf-parse
- **LLM**: Groq (`llama-3.1-8b-instant`) — free tier, used only for unrecognized document types
- **Language**: TypeScript

## Setup

```bash
npm install
```

Create a `.env` file in this directory:

```bash
GROQ_API_KEY=your_key_here
```

Get a free key at [console.groq.com](https://console.groq.com).

## Running

```bash
# development (watch mode)
npm run start:dev

# production
npm run build
npm run start:prod
```

Server starts on `http://localhost:3000`.

## API

### `POST /upload`

Upload a PDF file for extraction.

**Request** — multipart/form-data, field name `file`, PDF only, max 10MB.

```bash
curl -X POST http://localhost:3000/upload -F "file=@invoice.pdf"
```

**Response — recognized document type**

```json
{
  "success": true,
  "type": "invoice",
  "data": {
    "type": "invoice",
    "invoiceNumber": "INV-001",
    "total": "1500.00",
    "date": "2024-04-22"
  },
  "summary": "Invoice document. Invoice number: INV-001. Total amount: $1500.00. Date: 2024-04-22.",
  "rawText": "First 500 chars of extracted text..."
}
```

**Response — unrecognized document type**

```json
{
  "success": true,
  "type": "generic_document",
  "message": "Document parsed but type not recognized. Returning full text.",
  "fullText": "...",
  "summary": "AI-generated summary from Groq..."
}
```

**Supported document types**: `invoice`, `bank_statement`, `generic_document`

## Supported Document Types

| Type | Detected by | Fields extracted |
|---|---|---|
| Invoice | keyword `invoice` | invoiceNumber, total, date |
| Bank statement | keywords `bank statement`, `balance`, etc. | accountNumber, balance, bankName |
| Generic | fallback | fullText + LLM summary |

## Tests

```bash
npm run test        # unit tests
npm run test:e2e    # end-to-end tests
```
