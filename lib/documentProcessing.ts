/**
 * Split text into chunks for embedding with improved semantic boundaries
 * Optimized for nomic-embed-text model which works best with 512-1024 characters
 * @param text - The text to split into chunks
 * @param chunkSize - Maximum characters per chunk (default: 800 - optimal for embeddings)
 * @param overlap - Number of characters to overlap between chunks (default: 200)
 * @returns Array of text chunks
 */
export function chunkText(
  text: string,
  chunkSize: number = 1700,
  overlap: number = 250
): string[] {
  const chunks: string[] = [];

  // Preserve paragraph structure but normalize whitespace within paragraphs
  // Split on double newlines to preserve paragraph boundaries
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim());

  let currentChunk = "";
  let previousOverlap = "";

  for (const paragraph of paragraphs) {
    if (!paragraph) continue;

    // If adding this paragraph would exceed chunk size
    if (currentChunk.length + paragraph.length + 1 > chunkSize) {
      // If current chunk has content, save it
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());

        // Calculate overlap for next chunk
        const overlapStart = Math.max(0, currentChunk.length - overlap);
        previousOverlap = currentChunk.slice(overlapStart).trim();
      }

      // If paragraph itself is larger than chunk size, split it
      if (paragraph.length > chunkSize) {
        const subChunks = splitLongText(paragraph, chunkSize, overlap);

        for (let i = 0; i < subChunks.length; i++) {
          if (i === 0 && previousOverlap) {
            chunks.push((previousOverlap + " " + subChunks[i]).trim());
          } else {
            chunks.push(subChunks[i]);
          }
        }

        // Set up overlap for next chunk
        const lastSubChunk = subChunks[subChunks.length - 1];
        const overlapStart = Math.max(0, lastSubChunk.length - overlap);
        previousOverlap = lastSubChunk.slice(overlapStart).trim();
        currentChunk = "";
      } else {
        // Start new chunk with overlap and this paragraph
        currentChunk = previousOverlap
          ? previousOverlap + " " + paragraph
          : paragraph;
      }
    } else {
      // Add paragraph to current chunk
      currentChunk = currentChunk ? currentChunk + " " + paragraph : paragraph;
    }
  }

  // Add final chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  // Filter out empty chunks and very small chunks (< 50 chars)
  return chunks.filter((chunk) => chunk.length >= 50);
}

/**
 * Helper function to split long text that exceeds chunk size
 * Uses sentence boundaries for more natural splits
 */
function splitLongText(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  const chunks: string[] = [];
  let position = 0;

  while (position < text.length) {
    let chunkEnd = Math.min(position + chunkSize, text.length);

    // Try to find a good breaking point
    if (chunkEnd < text.length) {
      // Look for sentence endings (., !, ?) followed by space
      let foundBoundary = false;

      // Search backwards from chunkEnd, but not more than 30% back
      const searchStart = Math.max(
        position + Math.floor(chunkSize * 0.7),
        position
      );

      for (let i = chunkEnd; i > searchStart; i--) {
        const char = text[i - 1];
        const nextChar = text[i];

        // Look for sentence boundaries
        if (
          (char === "." || char === "!" || char === "?") &&
          nextChar === " "
        ) {
          chunkEnd = i;
          foundBoundary = true;
          break;
        }
      }

      // If no sentence boundary, look for comma or space
      if (!foundBoundary) {
        for (let i = chunkEnd; i > searchStart; i--) {
          const char = text[i - 1];
          if (char === "," || char === " ") {
            chunkEnd = i;
            break;
          }
        }
      }
    }

    // Extract chunk
    const chunk = text.slice(position, chunkEnd).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move forward with overlap
    position = chunkEnd;

    // If there's more text, go back by overlap amount to create overlap
    if (position < text.length && chunks.length > 0) {
      position = Math.max(position - overlap, chunkEnd - overlap);
      // Adjust to word boundary
      while (position > 0 && position < text.length && text[position] !== " ") {
        position++;
      }
    }
  }

  return chunks;
}

/**
 * Generate a unique ID for a document chunk
 */
export function generateChunkId(
  filename: string,
  chunkIndex: number,
  timestamp: number
): string {
  return `${filename}-chunk-${chunkIndex}-${timestamp}`;
}

/**
 * Extract metadata from a document
 */
export function extractMetadata(
  filename: string,
  fileType: string,
  fileSize: number,
  chunkIndex: number,
  totalChunks: number
): Record<string, string | number> {
  return {
    filename,
    fileType,
    fileSize,
    chunkIndex,
    totalChunks,
    uploadedAt: new Date().toISOString(),
  };
}
