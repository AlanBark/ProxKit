# PDF Manager - Background PDF Generation System

## Overview

The PDF generation system has been completely rewritten to use **Web Workers**, moving PDF generation off the main thread to prevent UI lockups. The new system includes optimizations like caching, progress reporting, and a clean interface that only requires a list of cards.

## Architecture

### 1. **PDFManager** (`src/utils/pdf/PDFManager.ts`)
The main interface for PDF generation. This is what you interact with from the main thread.

**Key Features:**
- ✅ Non-blocking PDF generation via Web Worker
- ✅ Automatic caching with intelligent invalidation
- ✅ Progress reporting (0-100%)
- ✅ Support for null cards (blank placeholders)
- ✅ Cancellation support
- ✅ Memory-safe cleanup

**Usage Example:**
```typescript
import { PDFManager } from './utils/pdf/PDFManager';

// Initialize
const manager = new PDFManager(pageSettings, cardWidth, cardHeight);

// Set up progress callback (optional)
manager.onProgress = (current, total, percentage) => {
  console.log(`Page ${current}/${total} (${percentage}%)`);
};

// Generate PDF (returns blob URL)
const pdfUrl = await manager.generatePDF(cards);

// Use pdfUrl for download/display
// ...

// Clean up when done
manager.dispose();
```

### 2. **PDF Worker** (`src/workers/pdfWorker.ts`)
Background thread that handles the actual PDF generation using pdf-lib.

**Key Features:**
- ✅ Runs in separate thread (non-blocking)
- ✅ Reports progress during generation
- ✅ Supports cancellation
- ✅ Handles errors gracefully
- ✅ Generates pages incrementally

### 3. **Worker Types** (`src/utils/pdf/workerTypes.ts`)
Type-safe message definitions for worker communication.

**Message Types:**
- `GENERATE_PDF` - Request to generate PDF
- `GENERATE_PDF_SUCCESS` - PDF generated successfully
- `GENERATE_PDF_ERROR` - Generation failed
- `GENERATE_PDF_PROGRESS` - Progress update
- `CANCEL_GENERATION` - Cancel ongoing generation

## Simple Interface

### Basic Usage

The PDFManager provides a clean interface - just pass an array of cards:

```typescript
// Array of cards to render
const cards: CardImage[] = [
  { id: "1", imageUrl: "blob:...", name: "Card 1", bleed: 3 },
  { id: "2", imageUrl: "blob:...", name: "Card 2", bleed: 3 },
  // ...
];

// Generate PDF
const pdfUrl = await manager.generatePDF(cards);
```

### Blank Card Support

Pass `null` to skip a position and render a blank card:

```typescript
const cards: (CardImage | null)[] = [
  { id: "1", imageUrl: "blob:...", name: "Card 1", bleed: 3 },
  null, // blank card
  { id: "2", imageUrl: "blob:...", name: "Card 2", bleed: 3 },
  null, // blank card
];

const pdfUrl = await manager.generatePDF(cards);
```

## Optimizations

### 1. **Automatic Caching**
The PDFManager automatically caches generated PDFs and only regenerates when:
- Cards array changes (by ID or bleed values)
- Page settings change
- Card dimensions change

```typescript
// First call - generates PDF
const url1 = await manager.generatePDF(cards);

// Second call with same cards - returns cached URL (instant!)
const url2 = await manager.generatePDF(cards);

console.log(url1 === url2); // true
```

### 2. **Incremental Generation**
The worker generates PDF pages one at a time, reporting progress:

```typescript
manager.onProgress = (current, total, percentage) => {
  // Update UI with progress
  updateProgressBar(percentage);
};
```

### 3. **Memory Management**
Old blob URLs are automatically revoked to prevent memory leaks:

```typescript
// Old URL is automatically cleaned up
manager.invalidateCache(); // or
manager.dispose();
```

### 4. **Page-by-Page Generation**
The worker processes pages incrementally rather than loading everything into memory at once. This improves performance for large card sets.

## Integration with AppContext

The AppContext has been updated to use PDFManager:

```typescript
// In AppContext.tsx
const pdfManagerRef = useRef<PDFManager | null>(null);
const [generationProgress, setGenerationProgress] = useState(0);

// Initialize
useEffect(() => {
  pdfManagerRef.current = new PDFManager(pageSettings, cardWidth, cardHeight);

  pdfManagerRef.current.onProgress = (_current, _total, percentage) => {
    setGenerationProgress(percentage);
  };

  return () => pdfManagerRef.current?.dispose();
}, [pageSettings, cardWidth, cardHeight]);

// Auto-generate on cards change
useEffect(() => {
  const generatePDF = async () => {
    if (!pdfManagerRef.current || cards.length === 0) {
      setPdfUrl(null);
      return;
    }

    setIsGenerating(true);
    try {
      const url = await pdfManagerRef.current.generatePDF(cards);
      setPdfUrl(url);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  generatePDF();
}, [cards]);
```

## API Reference

### PDFManager

#### Constructor
```typescript
constructor(
  pageSettings: PageSettings,
  cardWidth: number,
  cardHeight: number
)
```

#### Properties
```typescript
onProgress: ProgressCallback | null
// Callback for progress updates: (current, total, percentage) => void
```

#### Methods

**generatePDF(cards)**
```typescript
async generatePDF(cards: (CardImage | null)[]): Promise<string>
```
Generate PDF and return blob URL. Uses cache if available.

**updatePageSettings(pageSettings)**
```typescript
updatePageSettings(pageSettings: PageSettings): void
```
Update page size/margins (invalidates cache).

**updateCardDimensions(width, height)**
```typescript
updateCardDimensions(width: number, height: number): void
```
Update card dimensions (invalidates cache).

**cancelGeneration()**
```typescript
cancelGeneration(): void
```
Cancel ongoing PDF generation.

**invalidateCache()**
```typescript
invalidateCache(): void
```
Force regeneration on next request.

**isGenerating()**
```typescript
isGenerating(): boolean
```
Check if generation is in progress.

**getCachedUrl()**
```typescript
getCachedUrl(): string | null
```
Get cached URL without triggering generation.

**dispose()**
```typescript
dispose(): void
```
Clean up worker and resources.

## Error Handling

The system includes comprehensive error handling:

```typescript
try {
  const pdfUrl = await manager.generatePDF(cards);
  // Success
} catch (error) {
  console.error("PDF generation failed:", error);
  // Handle error - show message to user
}
```

Errors are automatically reported via:
1. Promise rejection in `generatePDF()`
2. Console errors for worker errors
3. Placeholder rectangles for failed card images

## Performance Characteristics

### Before (PDFSession)
- ❌ Runs on main thread
- ❌ UI freezes during generation
- ❌ No progress feedback
- ❌ Regenerates entire PDF on any change
- ✅ Simple caching

### After (PDFManager)
- ✅ Runs in Web Worker (separate thread)
- ✅ UI remains responsive
- ✅ Real-time progress updates
- ✅ Intelligent caching with invalidation
- ✅ Page-by-page generation
- ✅ Cancellation support

## Migration from PDFSession

If you have code using the old `PDFSession`:

**Before:**
```typescript
const session = new PDFSession(pageSettings);
session.addCard(card);
session.removeCard(cardId);
session.updateCardBleed(cardId, bleed);
const url = await session.generatePDF();
```

**After:**
```typescript
const manager = new PDFManager(pageSettings, cardWidth, cardHeight);
// Just manage cards in React state
const [cards, setCards] = useState<CardImage[]>([]);
// Generate whenever needed
const url = await manager.generatePDF(cards);
```

The new system is simpler - you just manage cards in state and call `generatePDF()` when needed!

## Browser Compatibility

Web Workers are supported in all modern browsers:
- ✅ Chrome/Edge 4+
- ✅ Firefox 3.5+
- ✅ Safari 4+
- ✅ Opera 10.6+

## Future Optimizations

Potential improvements for the future:

1. **Partial PDF Updates**: Only regenerate changed pages
2. **Image Caching**: Cache embedded images between generations
3. **Compression**: Optimize PDF size
4. **Batch Processing**: Process multiple cards in parallel
5. **IndexedDB Storage**: Persist cached PDFs across sessions

## Troubleshooting

### PDF generation is slow
- Check console for image loading errors
- Ensure images are properly sized (not too large)
- Consider reducing number of cards per generation

### Worker initialization fails
- Verify Vite configuration supports web workers
- Check browser console for detailed error messages
- Ensure pdf-lib is installed: `npm install pdf-lib`

### Progress callback not firing
- Ensure you set `onProgress` before calling `generatePDF()`
- Check that generation hasn't been cancelled

### Memory leaks
- Always call `dispose()` when done with PDFManager
- The manager automatically revokes old blob URLs

## Summary

The new PDF generation system provides:
- **Non-blocking generation** via Web Workers
- **Simple interface** - just provide cards array
- **Automatic optimizations** - caching, progress, cleanup
- **Better UX** - responsive UI with progress feedback
- **Production-ready** - error handling, cancellation, memory management

No need to manually manage PDF state - just call `generatePDF(cards)` and let the system handle the rest!
