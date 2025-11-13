import { streamText, UIMessage, convertToModelMessages } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import { OLLAMA_BASE_URL } from "@/constants";

// Configure Ollama provider with custom server URL
const ollama = createOllama({
  baseURL: OLLAMA_BASE_URL,
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: ollama("granite4"),
    // model: ollama("qwen3:8b"),
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
