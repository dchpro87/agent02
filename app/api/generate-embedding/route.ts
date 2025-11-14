import { NextRequest, NextResponse } from "next/server";
import { embed } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import { OLLAMA_BASE_URL } from "@/constants";

const ollama = createOllama({
  baseURL: OLLAMA_BASE_URL,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const { embedding } = await embed({
      model: ollama.textEmbeddingModel("nomic-embed-text"),
      value: text,
    });

    return NextResponse.json({ embedding });
  } catch (error) {
    console.error("Embedding generation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate embedding",
      },
      { status: 500 }
    );
  }
}
