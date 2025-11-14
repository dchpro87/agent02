/**
 * Split text into chunks for embedding
 * @param text - The text to split into chunks
 * @param chunkSize - Maximum characters per chunk (default: 1000)
 * @param overlap - Number of characters to overlap between chunks (default: 200)
 * @returns Array of text chunks
 */
export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];

  // Clean up the text - normalize whitespace
  const cleanText = text.replace(/\s+/g, " ").trim();

  // If text is shorter than chunk size, return as single chunk
  if (cleanText.length <= chunkSize) {
    return [cleanText];
  }

  // Ensure overlap is smaller than chunk size
  const effectiveOverlap = Math.min(overlap, Math.floor(chunkSize * 0.5));

  let position = 0;

  while (position < cleanText.length) {
    // Determine the end of this chunk
    let chunkEnd = Math.min(position + chunkSize, cleanText.length);

    // If we're not at the end of the text, try to find a good break point
    if (chunkEnd < cleanText.length) {
      // Look backwards from chunkEnd to find a sentence boundary
      let foundBoundary = false;

      // First try to find sentence endings (., !, ?)
      for (let i = chunkEnd; i > position + chunkSize * 0.5; i--) {
        const char = cleanText[i - 1];
        if (char === "." || char === "!" || char === "?") {
          chunkEnd = i;
          foundBoundary = true;
          break;
        }
      }

      // If no sentence boundary, try to find a space
      if (!foundBoundary) {
        for (let i = chunkEnd; i > position + chunkSize * 0.5; i--) {
          if (cleanText[i - 1] === " ") {
            chunkEnd = i;
            break;
          }
        }
      }
    }

    // Extract the chunk
    const chunk = cleanText.slice(position, chunkEnd).trim();

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move position forward
    // The step size is chunkSize - overlap to create the overlap effect
    position += chunkSize - effectiveOverlap;

    // Safety check: if we didn't make progress, force move forward
    if (position <= (chunks.length > 0 ? chunkEnd - chunkSize : 0)) {
      position = chunkEnd;
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
