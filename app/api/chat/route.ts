import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import { OLLAMA_BASE_URL } from "@/constants";
import { createGetAdditionalContextTool } from "@/lib/tools";

// Configure Ollama provider with custom server URL
const ollama = createOllama({
  baseURL: OLLAMA_BASE_URL,
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    model,
    systemPrompt,
    modelSupportsTools,
    selectedCollection,
  }: {
    messages: UIMessage[];
    model: string;
    systemPrompt?: string;
    modelSupportsTools?: boolean;
    selectedCollection?: string | null;
  } = await req.json();

  console.log("\n\n--- 💥New chat request💥 ---");
  console.log("Model:", model);
  console.log("System prompt:", systemPrompt ? "Yes" : "No");
  console.log("Model supports tools:", modelSupportsTools);
  console.log("Selected collection:", selectedCollection);

  // Only enable tools if the model supports them
  if (modelSupportsTools) {
    // Add system prompt instruction with collection information
    const toolInstruction = `\n\nINSTRUCTION 1: You have access to external tools to assist in answering the user's question. Always attempt to use them to enhance your responses.`;
    const collectionInstruction = selectedCollection
      ? `\n\nINSTRUCTION 2: If you require additional context use the getAdditionalContext tool with the '${selectedCollection}' collection to provide the most relevant information.`
      : ` No specific collection was selected. You will have to remind the user to select a collection if needed.`;
    const enhancedSystemPrompt = modelSupportsTools
      ? (systemPrompt || "") + toolInstruction + collectionInstruction
      : // (systemPrompt || "") + collectionInstruction
        systemPrompt || "";

    console.log("Enhanced system prompt for tool usage:", enhancedSystemPrompt);

    const result = streamText({
      // model: ollama(model || "granite4"),
      model: ollama(model),
      system: enhancedSystemPrompt,
      messages: convertToModelMessages(messages),
      abortSignal: req.signal,
      tools: {
        getAdditionalContext: createGetAdditionalContextTool(
          selectedCollection || undefined
        ),
      },
      // Enable multi-step tool calling - model can use tools and then respond
      stopWhen: stepCountIs(5),
      // Log when tool execution completes
      onStepFinish({ text, toolCalls, toolResults, finishReason }) {
        console.log("Step finished:", {
          hasText: !!text,
          toolCallsCount: toolCalls.length,
          toolResultsCount: toolResults.length,
          finishReason,
        });

        if (toolCalls.length > 0) {
          console.log(
            "Tool calls:",
            toolCalls.map((tc) => ({
              toolName: tc.toolName,
              input: tc.input,
            }))
          );
        }
      },
    });

    return result.toUIMessageStreamResponse();
  }

  // No tools - standard text generation
  const result = streamText({
    model: ollama(model),
    system: systemPrompt,
    messages: convertToModelMessages(messages),
    abortSignal: req.signal,
  });

  return result.toUIMessageStreamResponse();
}
