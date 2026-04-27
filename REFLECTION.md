# AI Reflection Log

This document explains how I used AI tools during the assignment — where they actually helped, and where I had to step in and fix or rethink things.

---

## Tools Used

- Claude Code (Anthropic) — my primary tool
- ChatGPT — for cross-checking ideas, debugging help, and refining approaches

---

## Where AI Helped

### 1. NestJS module scaffolding

I used AI to generate the initial NestJS structure — module, controller, service, and extractor interface. This saved time since the setup is pretty repetitive. The output was clean and mostly correct, so I kept it with minimal changes.

### 2. Regex patterns for field extraction

I asked AI to generate regex patterns for extracting invoice number, total, and date. It gave me a decent starting point. From there, I tested against actual PDFs and refined the patterns because real-world data had more edge cases than the initial output covered.

### 3. Groq API integration

AI helped generate the axios request for the Groq API (chat completions). The request format was mostly correct — model, messages, headers, etc. I only had to tweak a few things before using it.

### 4. Error classification in upload service

When I described how I wanted to handle different types of errors (like corrupted PDFs vs server issues), AI suggested using regex checks on error messages to classify them. That worked well, and I kept that approach.

### 5. Frontend component structure

I used AI to generate a basic React component with file upload handling and result display. It worked as a starting point, but I ended up reworking the styling and improving the UX myself.

---

## Where AI Was Wrong or Incomplete

### 1. Suggested using LLM for everything

Initially, AI treated all document types the same and suggested calling the LLM for every upload. That didn’t make sense for this assignment because of cost and efficiency.

I changed this by introducing a tiered approach:

- Known document types → deterministic summaries
- Unknown types → fallback to Groq

This was a conscious architectural decision from my side.

### 2. LLM logic placed in the wrong layer

AI initially put the Groq API call directly inside the upload service. That goes against good design principles and the assignment requirement of keeping external services isolated.

I refactored it into a separate `SummaryService` and injected it properly using NestJS DI. This made the code cleaner and easier to maintain.

### 3. Weak regex for invoice total

The original regex (`TOTAL: \d+`) was too generic and ended up matching the wrong values like subtotals.

I fixed this by:

- Adding multiple patterns
- Prioritizing more specific labels like “amount due”, “balance due”, etc.

This required actual testing and iteration — something AI didn’t handle well in one go.

### 4. pdf-parse import issue

AI suggested a straightforward import for `pdf-parse`, which compiled fine but failed at runtime due to module export differences.

I debugged this using the error stack and fixed it with:

```
(pdfParse as any).default || pdfParse
```

This was something I had to figure out manually.

### 5. Poor frontend UX feedback

The initial frontend only disabled the upload button during processing, which isn’t great UX.

I improved this by adding:

- A loading spinner
- “Analyzing document…” text
- Better visual feedback during upload

These changes came from reviewing the UI, not from AI suggestions.

---

## Summary

AI was really helpful for speeding up the basic, repetitive parts — setting up structure, generating initial code, and handling standard integrations.

But the important parts — architecture decisions, handling edge cases, debugging runtime issues, and improving user experience — required my own judgment and iteration.

Overall, AI acted more like a productivity booster than a replacement. I still had to understand everything I was building and make the final calls.
