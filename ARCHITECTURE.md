# PDF Document Extraction System - Architecture & Design

## Overview
This system intelligently extracts structured data from PDF documents using pattern matching (regex) and LLM-based summarization. It's designed to be scalable, maintainable, and extensible for multiple document types.

## Architecture

### 1. Folder Structure
```
src/
├── modules/
│   └── upload/
│       ├── upload.controller.ts    # Handles file upload requests
│       ├── upload.service.ts       # Core PDF processing logic
│       └── upload.module.ts        # Module definition
├── extractors/
│   ├── extractor.interface.ts      # Interface for all extractors
│   ├── invoice.extractor.ts        # Invoice-specific extraction
│   └── bank.extractor.ts           # Bank statement extraction
├── summary/
│   ├── summary.service.ts          # LLM integration for summaries
│   └── summary.module.ts           # Summary module
├── common/
│   └── utils/                      # Utility functions
└── app.module.ts                   # Main app module
```

## Component Details

### Upload Controller
- **Route**: `POST /upload`
- **Accepts**: PDF files via multipart form-data (field name: "file")
- **Validation**:
  - File must be provided
  - File must be PDF (MIME type validation)
- **Returns**: JSON with extraction results or error messages

### Upload Service
**Responsibilities**:
1. Parse PDF buffer using `pdf-parse` library
2. Extract raw text from PDF
3. Iterate through extractors to find matching handler
4. Call extractor to parse document
5. Generate LLM summary
6. Return structured response

**Error Handling**:
- No file uploaded
- No text extracted from PDF
- No matching extractor (unsupported document)
- PDF parsing failures

### Extractor System

#### Pattern: Strategy Design Pattern
Each extractor implements the `Extractor` interface:
```typescript
interface Extractor {
  canHandle(text: string): boolean;    // Returns true if this extractor can process the text
  extract(text: string): any;          // Extracts structured data from text
}
```

**Why Extractors?**
- **Separation of Concerns**: Document-specific logic is isolated
- **Easy to Add**: New document types require only a new extractor
- **Testability**: Each extractor can be tested independently
- **Scalability**: Easy to add queue-based processing for large files

#### Invoice Extractor
Extracts from invoices using regex patterns:
- Invoice number
- Total amount
- Date

#### Bank Extractor
Extracts from bank statements:
- Account number
- Balance
- Bank name

### Summary Service

**How it works**:
1. Takes extracted text (limited to 3000 chars to manage token costs)
2. Sends to OpenAI API via axios
3. Uses GPT-3.5-turbo to generate 2-3 line summary
4. Returns summary or error message

**Configuration**:
- Set `OPENAI_API_KEY` environment variable
- Uses GPT-3.5-turbo model (cost-effective)
- Max tokens: 150 for summary

**Fallback**:
- If API key not set, returns informative message
- Catches OpenAI API errors gracefully

## Regex vs LLM Approach

### Why Both?
1. **Regex (Pattern Matching)**:
   - ✅ Fast and predictable
   - ✅ No API costs
   - ✅ Works offline
   - ❌ Limited to known patterns
   - ❌ Brittle with format variations

2. **LLM (AI Summary)**:
   - ✅ Flexible, understands context
   - ✅ Handles variations
   - ✅ Generates human-readable summaries
   - ❌ Requires API key & costs money
   - ❌ Network dependent
   - ❌ May need fine-tuning

**Solution**: Use regex for structured extraction (invoices, statements) + LLM for general summary

## Response Format

### Success Response
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
  "summary": "Invoice INV-001 for $1500 issued on April 22, 2024. Contains charges for professional services rendered in April.",
  "rawText": "First 500 characters of extracted PDF text..."
}
```

### Error Response (No Extractor Match)
```json
{
  "success": false,
  "message": "Unsupported document type",
  "rawText": "First 500 characters of extracted PDF text..."
}
```

## Scaling Considerations

### For Large Volume
1. **Job Queue**: Use Bull/RabbitMQ for async processing
   ```typescript
   // Example: Add to queue instead of processing directly
   await this.uploadQueue.add({ fileId, buffer });
   ```

2. **Caching**: Cache summaries for identical documents
   ```typescript
   // Redis cache with hash of file content as key
   ```

3. **Batch Processing**: Group multiple PDFs
   - Process multiple files in parallel
   - Limit concurrent OpenAI API calls

4. **Database**: Store results
   ```typescript
   // Save extraction results with timestamps
   await this.uploadRepository.save(result);
   ```

### Example Scaling Flow
```
Upload API → Validation → Queue → Worker → DB
                ↓
              Error Handler
```

## Adding New Document Types

### Step 1: Create New Extractor
```typescript
import { Extractor } from './extractor.interface';

export class ContractExtractor implements Extractor {
  canHandle(text: string): boolean {
    return text.toLowerCase().includes('contract');
  }

  extract(text: string) {
    // Your extraction logic
    return { type: 'contract', /* extracted fields */ };
  }
}
```

### Step 2: Register in Upload Service
```typescript
private extractors = [
  new InvoiceExtractor(),
  new BankExtractor(),
  new ContractExtractor(),  // Add here
];
```

## Environment Variables

```bash
# Required for LLM summary feature
OPENAI_API_KEY=sk-...

# Optional: Future configurations
# PDF_MAX_SIZE=10mb
# CACHE_TTL=3600
```

## Testing Strategy

### Unit Tests
- Test each extractor independently
- Test regex patterns with various formats
- Test error cases

### Integration Tests
- Upload real PDF files
- Verify extraction accuracy
- Test with unsupported documents

### Example Test
```typescript
describe('InvoiceExtractor', () => {
  it('should extract invoice number', () => {
    const extractor = new InvoiceExtractor();
    const text = 'Invoice #INV-12345';
    const result = extractor.extract(text);
    expect(result.invoiceNumber).toBe('INV-12345');
  });
});
```

## API Usage Examples

### Upload and Extract
```bash
curl -X POST http://localhost:3000/upload \
  -F "file=@invoice.pdf"
```

### Response
```json
{
  "success": true,
  "type": "invoice",
  "data": { ... },
  "summary": "..."
}
```

## Dependencies

- `@nestjs/common` - NestJS core
- `@nestjs/platform-express` - Express integration for file upload
- `pdf-parse` - PDF text extraction
- `axios` - HTTP client for OpenAI API
- `multer` - File upload middleware

## Performance Notes

- PDF parsing: ~100-500ms per file (depends on size)
- LLM API call: ~1-3 seconds (network dependent)
- Regex extraction: ~10-50ms
- **Total per file**: ~1.5-3.5 seconds

## Future Enhancements

1. **Advanced Extractors**: Receipt, Pay stub, Medical records
2. **OCR Support**: Image-based PDFs
3. **Custom Fields**: User-defined extraction patterns
4. **Batch Upload**: Process multiple files simultaneously
5. **Web Dashboard**: View extraction history
6. **Alternative LLMs**: Claude, LLaMA, local models
7. **Webhook Notifications**: Alert when processing complete
