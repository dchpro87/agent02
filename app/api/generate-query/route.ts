import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import { OLLAMA_BASE_URL } from "@/constants";

const ollama = createOllama({
  baseURL: OLLAMA_BASE_URL,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, model } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (!model) {
      return NextResponse.json({ error: "Model is required" }, { status: 400 });
    }

    const prompt = `You are a query optimization assistant. Your task is to convert a user's message into an optimized search query for a vector database.

User message: "${message}"

Generate a clear, concise search query that captures the key concepts and intent of the user's message. The query should be optimized for semantic similarity search.

Return ONLY the search query text, without any explanations or additional text.`;

    const { text } = await generateText({
      model: ollama(model),
      prompt,
      abortSignal: request.signal,
    });

    const searchQuery = text.trim();

    return NextResponse.json({ query: searchQuery });
  } catch (error) {
    console.error("Query generation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate search query",
      },
      { status: 500 }
    );
  }
}
