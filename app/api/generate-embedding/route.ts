import { NextRequest, NextResponse } from 'next/server';
import { embed, embedMany } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';
import { OLLAMA_BASE_URL, DEFAULT_EMBEDDING_MODEL } from '@/constants';

const ollama = createOllama({
  baseURL: OLLAMA_BASE_URL,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, texts } = body;

    // Support both single and batch embedding
    if (texts && Array.isArray(texts)) {
      console.log(
        `[Embedding API] Batch request for ${
          texts.length
        } texts (total chars: ${texts.reduce((sum, t) => sum + t.length, 0)})`
      );

      if (texts.length === 0) {
        return NextResponse.json(
          { error: 'Texts array cannot be empty' },
          { status: 400 }
        );
      }

      const startTime = Date.now();

      // Batch embedding using embedMany for better performance
      const { embeddings } = await embedMany({
        model: ollama.textEmbeddingModel(DEFAULT_EMBEDDING_MODEL),
        values: texts,
        maxParallelCalls: 3, // Process up to 3 embeddings in parallel
      });

      const duration = Date.now() - startTime;
      console.log(
        `[Embedding API] Generated ${
          embeddings.length
        } embeddings in ${duration}ms (${(duration / texts.length).toFixed(
          0
        )}ms per embedding)`
      );

      return NextResponse.json({ embeddings });
    } else if (text) {
      console.log(
        `[Embedding API] Single request for text (${text.length} chars)`
      );

      // Single embedding
      const { embedding } = await embed({
        model: ollama.textEmbeddingModel(DEFAULT_EMBEDDING_MODEL),
        value: text,
      });

      console.log(
        `[Embedding API] Generated embedding with ${embedding.length} dimensions`
      );

      return NextResponse.json({ embedding });
    } else {
      return NextResponse.json(
        { error: "Either 'text' or 'texts' array is required" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[Embedding API] Error:', error);
    console.error(
      '[Embedding API] Error stack:',
      error instanceof Error ? error.stack : 'No stack trace'
    );

    // Provide more detailed error message
    let errorMessage = 'Failed to generate embedding';
    if (error instanceof Error) {
      errorMessage = error.message;

      // Check for specific error types
      if (error.message.includes('ECONNREFUSED')) {
        errorMessage =
          'Cannot connect to Ollama server. Please ensure Ollama is running.';
      } else if (error.message.includes('model')) {
        errorMessage = `Model error: ${error.message}. Please ensure '${DEFAULT_EMBEDDING_MODEL}' is available in Ollama.`;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timeout. The embedding request took too long.';
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
