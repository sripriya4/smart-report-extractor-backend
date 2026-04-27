# Smart Report Extractor — Design Document

## Overview

A NestJS service that accepts PDF uploads and returns structured field extraction plus a plain-English summary. It uses regex-based extraction for known document types and falls back to an LLM (Groq) only when the document type is unrecognized.

## Folder Structure

```
src/
├── modules/
│   └── upload/
│       ├── upload.controller.ts    # POST /upload — file validation and routing
│       ├── upload.service.ts       # Core processing: parse → classify → extract → summarize
│       └── upload.module.ts
├── extractors/
│   ├── extractor.interface.ts      # Extractor contract (canHandle + extract)
│   └── invoice.extractor.ts
├── summary/
│   ├── summary.service.ts          # Groq API integration (isolated HTTP service)
│   └── summary.module.ts
└── app.module.ts
```

## Request Flow

```
POST /upload (multipart PDF)
  → MIME + size validation (10MB limit)
  → pdf-parse: buffer → raw text
  → text empty? → return early with hint
  → iterate extractors (Strategy pattern)
      match found → regex extract → deterministic summary (no LLM)
      no match    → LLM summary via Groq
  → return JSON { success, type, data, summary }
```

## Extractor System (Strategy Pattern)

Each extractor implements:

```typescript
interface Extractor {
  canHandle(text: string): boolean;
  extract(text: string): any;
}
```

Adding a new document type = one new file + one line in `upload.service.ts`. No other changes needed.

**Current extractors:**
- `InvoiceExtractor` — detects `"invoice"` keyword; extracts invoice number, total, date, seller, order number

## Cost Design

The assignment constraint — *not every document should require the same processing overhead* — is addressed by tiering LLM usage:

| Document type | Summary method | LLM call? |
|---|---|---|
| Invoice | Built from extracted fields | No |
| Generic / unknown | Groq `llama-3.1-8b-instant` | Yes |

This means the common case (recognized document types) costs zero API calls. Groq is only invoked when regex extraction produces no match and there is no structured data to fall back on.

## Summary Service

Isolated as its own NestJS module — the LLM is treated as an external HTTP service, not embedded in business logic. It:
- Calls `https://api.groq.com/openai/v1/chat/completions`
- Uses `llama-3.1-8b-instant` (free tier)
- Truncates input to 3000 chars to control token cost
- Returns a graceful message if `GROQ_API_KEY` is not set

## Production Constraint Responses

**Volume** — The synchronous pipeline is fast for regex-matched docs (~150ms). For scale, the natural next step is a job queue (Bull/BullMQ) so uploads return a job ID immediately and results are fetched async.

**Accuracy** — Regex patterns handle clean, digital PDFs well. Scanned/image PDFs are detected (empty text) and rejected with a clear message. For higher accuracy on structured types, the extractors can be upgraded to LLM-assisted extraction selectively.

**Cost** — LLM only called for unrecognized documents. Recognized types use deterministic summarization at zero API cost.

**Reliability** — Missing API key degrades gracefully (returns message, not 500). PDF parse failures and malformed uploads return typed HTTP errors. File size capped at 10MB to prevent memory exhaustion.

## Adding a New Document Type

```typescript
// 1. Create src/extractors/contract.extractor.ts
export class ContractExtractor implements Extractor {
  canHandle(text: string): boolean {
    return text.toLowerCase().includes('contract');
  }
  extract(text: string) {
    return { type: 'contract', /* regex fields */ };
  }
}

// 2. Register in upload.service.ts
private extractors = [
  new InvoiceExtractor(),
  new ContractExtractor(), // add here
];
```

## Stack Notes

The assignment specifies MERN (Node.js + Express). NestJS is used here because it runs on Express under the hood and provides a structured module system that makes the extractor/service/controller separation cleaner to reason about and easier to test. React + Vite is used on the frontend. No MongoDB is used — documents are processed statelessly, with no persistence required by the current spec.

## Environment Variables

```bash
GROQ_API_KEY=your_key_here   # From console.groq.com — free tier
```

## Performance Profile

| Step | Typical time |
|---|---|
| PDF parse | 100–500ms |
| Regex extraction | <5ms |
| Deterministic summary | <1ms |
| Groq API call (generic docs only) | 500–2000ms |
