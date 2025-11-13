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
  const { messages, model }: { messages: UIMessage[]; model?: string } =
    await req.json();

  console.log("Received model:", model);

  const result = streamText({
    model: ollama(model || "granite4"),
    messages: convertToModelMessages(messages),
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse();
}
