import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import { OLLAMA_BASE_URL } from "@/constants";
import {
  createGetAdditionalContextTool,
  createWebSearchTool,
} from "@/lib/tools";

type Attachment = {
  name: string;
  contentType: string;
  url: string;
};

// Configure Ollama provider with custom server URL and fetch wrapper
const ollama = createOllama({
  baseURL: OLLAMA_BASE_URL,
  fetch: async (url, init) => {
    console.log("🌐 Ollama fetch called:", url);

    // Add abort listener to log when fetch is aborted
    if (init?.signal) {
      init.signal.addEventListener("abort", () => {
        console.log("🚫 Ollama fetch aborted for:", url);
      });
    }

    // Use the global fetch with the provided init options
    const response = await fetch(url, init);

    console.log("📡 Ollama response status:", response.status);
    return response;
  },
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json();
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
  } = body;

  // Extract experimental_attachments if present
  const attachments = body.experimental_attachments as Attachment[] | undefined;

  console.log("\n\n--- 💥New chat request💥 ---");
  console.log("Model:", model);
  console.log("System prompt:", systemPrompt ? "Yes" : "No");
  console.log("Model supports tools:", modelSupportsTools);
  console.log("Selected collection:", selectedCollection);
  console.log("Messages:", messages.map((m) => m.role).join(", "));
  console.log("Attachments:", attachments?.length || 0);

  // Add abort signal listener for debugging
  req.signal.addEventListener("abort", () => {
    console.log("🚫 Request aborted by client");
  });

  // Convert UI messages to model messages
  const modelMessages = convertToModelMessages(messages);

  // If there are attachments, add them to the last user message
  if (attachments && attachments.length > 0) {
    console.log("Processing attachments...");
    // Find the last user message
    for (let i = modelMessages.length - 1; i >= 0; i--) {
      if (modelMessages[i].role === "user") {
        const lastUserMessage = modelMessages[i];
        // Convert attachments to image parts
        const imageParts = attachments.map((attachment) => ({
          type: "image" as const,
          image: attachment.url, // data URL from the client
        }));

        // Combine existing content with image parts
        if (typeof lastUserMessage.content === "string") {
          lastUserMessage.content = [
            ...imageParts,
            { type: "text" as const, text: lastUserMessage.content },
          ];
        } else if (Array.isArray(lastUserMessage.content)) {
          // Filter to only include compatible part types
          const compatibleParts = lastUserMessage.content.filter(
            (part) =>
              part.type === "text" ||
              part.type === "image" ||
              part.type === "file"
          );
          lastUserMessage.content = [
            ...imageParts,
            ...compatibleParts,
          ] as typeof lastUserMessage.content;
        }
        console.log("Added", imageParts.length, "image(s) to user message");
        break;
      }
    }
  }

  // Only enable tools if the model supports them
  if (modelSupportsTools) {
    // Add system prompt instruction with collection informationa and current date time
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    };
    const dateStr = now.toLocaleDateString("en-US", options);
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const currentDateTime = `Today's date is ${dateStr} and the time is ${timeStr}`;
    const toolInstruction = `\n\nINSTRUCTION 1: you have access to external tools to assist in answering the user's question. Always attempt to use them to enhance your responses.`;
    const collectionInstruction = selectedCollection
      ? `\n\nINSTRUCTION 2: Never rely on your own knowledge. Always use the getAdditionalContext tool with the '${selectedCollection}' collection to provide the most relevant information.`
      : ` No specific collection was selected. You will have to remind the user to select a collection if needed.`;
    const enhancedSystemPrompt = modelSupportsTools
      ? currentDateTime +
        toolInstruction +
        collectionInstruction +
        (`${"\n\n"}` + systemPrompt || "")
      : // (systemPrompt || "") + collectionInstruction
        currentDateTime + (systemPrompt || "");

    console.log("Enhanced system prompt for tool usage:", enhancedSystemPrompt);

    const result = streamText({
      // model: ollama(model || "granite4"),
      model: ollama(model),
      system: enhancedSystemPrompt,
      messages: modelMessages,
      abortSignal: req.signal,
      tools: {
        getAdditionalContext: createGetAdditionalContextTool(
          selectedCollection || undefined,
          req.signal
        ),
        webSearch: createWebSearchTool(req.signal),
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

        // Check if abort was signaled during step
        if (req.signal.aborted) {
          console.log("🚫 Abort detected during step finish");
        }
      },
    });

    return result.toUIMessageStreamResponse();
  }

  // No tools - standard text generation
  const result = streamText({
    model: ollama(model),
    system: systemPrompt,
    messages: modelMessages,
    abortSignal: req.signal,
  });

  // Check if abort was signaled
  req.signal.addEventListener("abort", () => {
    console.log("🚫 Non-tool request aborted");
  });

  return result.toUIMessageStreamResponse();
}
