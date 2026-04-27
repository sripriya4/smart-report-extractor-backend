# Design Document — Smart Report Extractor (Backend)

## Problem Statement

Users need to upload arbitrary PDF documents and get back structured, typed data — not just raw text. The challenge is that PDFs have no standard schema: an invoice, a research paper, and a lease agreement all look completely different. The system must handle all of them without requiring a separate integration per document type.

---

## Architecture Overview

```
React (Vite)
    │  multipart/form-data POST /upload
    ▼
NestJS (upload.controller.ts)
    │  validates file type + size
    ▼
UploadService.processFile()
    │
    ├─ pdf-parse → raw text
    │
    ├─ [Extractor loop]
    │       ├─ InvoiceExtractor.canHandle()? → YES → regex extract → buildStructuredSummary()
    │       └─ no match ──────────────────────────────────────────────────────────────┐
    │                                                                                  │
    └─ SummaryService.extractStructured() ◄───────────────────────────────────────────┘
            │  Groq LLM (llama-3.1-8b-instant)
            └─ returns { fields: {...}, summary: "..." }
```

---

## Key Design Decisions

### 1. Regex-first, LLM-as-fallback

For recognised document types (invoices), structured fields are extracted with regex patterns rather than calling the LLM.

**Why:** LLMs add ~1–2 seconds of latency and cost money per call. For well-structured formats like invoices, regex is faster, cheaper, and fully deterministic — it produces the same output for the same input every time, which makes it easier to test and debug. The LLM is only invoked when no regex extractor can handle the document.

### 2. Pluggable Extractor interface

All format-specific extractors implement a two-method interface:

```ts
interface Extractor {
  canHandle(text: string): boolean;
  extract(text: string): any;
}
```

Extractors are registered in an array in `UploadService`. The service loops through them and delegates to the first match.

**Why:** Adding a new document type (e.g. bank statement, purchase order) requires writing one new class and adding it to the array — no changes to the controller, service logic, or LLM path. This keeps new format support isolated and testable independently.

### 3. LLM extracts fields + summary in one call

For generic documents, a single Groq API call returns both structured key-value fields and a plain-English summary as a JSON object, rather than making two separate calls.

**Why:** Reduces latency and API cost by half for the generic path. The fields and summary share the same document context, so the model only needs to read and reason over the text once.

### 4. Groq over OpenAI

The LLM layer uses Groq's API (`llama-3.1-8b-instant`) rather than OpenAI.

**Why:** Groq's free tier is generous enough for development and low-volume production use. The `llama-3.1-8b-instant` model is fast (typically under 1 second for short prompts) and sufficient for field extraction from document text. OpenAI's GPT-4o would give higher accuracy on ambiguous documents but at significantly higher cost and with more latency.

### 5. LLM failures degrade gracefully

The Groq call is wrapped in a try/catch that returns `{ fields: {}, summary: 'Could not generate summary.' }` on any failure — network error, rate limit, invalid JSON response.

**Why:** The PDF was parsed successfully. Losing the LLM call should not cause the entire upload to fail with a 500. The user gets a result; the fields and summary are just empty. This is a better experience than an error page for something outside the user's control.

### 6. Temperature 0.2 for structured output

The Groq prompt uses `temperature: 0.2` rather than a higher value.

**Why:** The model is asked to return JSON. Higher temperatures introduce variability that can corrupt the JSON structure (e.g. adding prose before the opening brace, hallucinating extra keys). Low temperature makes the output more predictable and reduces JSON parse failures.

---

## Data Flow — Step by Step

1. Client sends `multipart/form-data` POST to `/upload`
2. Multer intercepts the request, enforces the 50MB file size limit
3. Controller validates: file must be present and have a PDF mimetype
4. `pdf-parse` reads the file buffer and extracts plain text
5. If text is empty, return `success: false` (scanned/image PDF — no OCR support)
6. Loop through registered extractors:
   - `canHandle(text)` checks for format signals (e.g. the word "invoice")
   - First match calls `extract(text)` to get typed fields via regex
   - `buildStructuredSummary()` produces a human-readable summary from the fields
   - Return `{ success, type, data, summary }`
7. If no extractor matches, call `SummaryService.extractStructured(text)`
   - Prompt instructs Groq to return JSON with `fields` and `summary`
   - Strip markdown fences from response, parse JSON
   - Return `{ success, type: 'generic_document', data: fields, summary }`
8. On any PDF format error, throw a user-friendly `BadRequestException`

---

## Trade-offs and Known Limitations

| Limitation | Impact | Potential fix |
|---|---|---|
| Regex breaks on unusual invoice layouts | Missed fields returned as `null` | Train a small classifier or expand regex patterns |
| No OCR support | Scanned PDFs return no data | Integrate Tesseract or a cloud OCR service |
| LLM fields are dynamic strings, not typed | Field names vary between documents | Add a post-processing normalisation step |
| Generic extraction limited to first 3000 chars | Long documents may miss later fields | Chunk the document and merge results |
| Single-threaded synchronous processing | Large PDFs block the event loop briefly | Move PDF parsing to a worker thread |
| No persistent storage | Results are not saved | Add a database layer for history and reprocessing |

---

## What Would Change at Scale

- **Async processing via a queue** — at volume, PDF processing should be offloaded to a job queue (e.g. BullMQ) so the HTTP response returns immediately with a job ID, and the client polls or receives a webhook when the result is ready.
- **Document classification model** — instead of `canHandle()` checks, a small fine-tuned classifier could route documents to the right extractor more reliably than keyword matching.
- **Caching** — identical file hashes could skip reprocessing entirely.
- **Structured LLM output via function calling** — instead of prompting for raw JSON and parsing it, use the model's function-calling or structured output feature to guarantee schema compliance.
