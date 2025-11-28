import {
  Bot,
  User,
  Database,
  Brain,
  ChevronDown,
  ChevronUp,
  Wrench,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { UIMessage } from "ai";
import Image from "next/image";
import MarkdownMessage from "./MarkdownMessage";

type MessagePart = {
  type: string;
  text?: string;
  state?: string;
  [key: string]: unknown;
};

type MessageContainerProps = {
  messages: UIMessage[];
  status: string;
  isQueryingKnowledge?: boolean;
};

function ReasoningSection({ parts }: { parts: MessagePart[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (parts.length === 0) return null;

  const reasoningText = parts.map((part) => part.text).join("");

  return (
    <div className='mb-3 border-b border-zinc-200 dark:border-zinc-700 pb-3'>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className='flex items-center gap-2 w-full text-left text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors'
      >
        <Brain className='w-4 h-4 text-purple-600 dark:text-purple-400' />
        <span>Reasoning</span>
        {isExpanded ? (
          <ChevronUp className='w-4 h-4 ml-auto' />
        ) : (
          <ChevronDown className='w-4 h-4 ml-auto' />
        )}
      </button>
      {isExpanded && (
        <div className='mt-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'>
          <p className='text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap'>
            {reasoningText}
          </p>
        </div>
      )}
    </div>
  );
}

function ToolUsageSection({ parts }: { parts: MessagePart[] }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (parts.length === 0) return null;

  return (
    <div className='mb-3 border-b border-zinc-200 dark:border-zinc-700 pb-3'>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className='flex items-center gap-2 w-full text-left text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors'
      >
        <Wrench className='w-4 h-4 text-blue-600 dark:text-blue-400' />
        <span>Tool Usage</span>
        <span className='text-xs text-zinc-500 dark:text-zinc-400 ml-1'>
          ({parts.length})
        </span>
        {isExpanded ? (
          <ChevronUp className='w-4 h-4 ml-auto' />
        ) : (
          <ChevronDown className='w-4 h-4 ml-auto' />
        )}
      </button>
      {isExpanded && (
        <div className='mt-2 space-y-2'>
          {parts.map((part, index) => {
            const partAny = part as Record<string, unknown>;
            const toolName =
              (partAny.toolName as string) || part.type.replace("tool-", "");
            const state = part.state || "unknown";
            const input = partAny.input;
            const output = partAny.output;
            const errorText = partAny.errorText as string | undefined;

            return (
              <div
                key={index}
                className='p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
              >
                <div className='flex items-center gap-2 mb-2'>
                  <span className='text-xs font-semibold text-blue-700 dark:text-blue-300'>
                    {toolName}
                  </span>
                  <span className='text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300'>
                    {state}
                  </span>
                </div>

                {input !== undefined && (
                  <div className='text-xs text-zinc-600 dark:text-zinc-400 mb-2'>
                    <span className='font-medium'>Input:</span>
                    <pre className='mt-1 p-2 rounded bg-white dark:bg-zinc-800 overflow-x-auto'>
                      {JSON.stringify(input, null, 2)}
                    </pre>
                  </div>
                )}

                {state === "output-available" && output !== undefined && (
                  <div className='text-xs text-zinc-600 dark:text-zinc-400'>
                    <span className='font-medium'>Result:</span>
                    <pre className='mt-1 p-2 rounded bg-white dark:bg-zinc-800 overflow-x-auto'>
                      {JSON.stringify(output, null, 2)}
                    </pre>
                  </div>
                )}

                {state === "output-error" && errorText && (
                  <div className='text-xs text-red-600 dark:text-red-400'>
                    <span className='font-medium'>Error:</span>
                    <p className='mt-1'>{errorText}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MessageContainer({
  messages,
  status,
  isQueryingKnowledge = false,
}: MessageContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, status]);
  const extractThinkingContent = (
    text: string
  ): { thinking: string; content: string } => {
    // Match content between <think> and </think> tags
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
    const matches = [...text.matchAll(thinkRegex)];

    if (matches.length === 0) {
      return { thinking: "", content: text };
    }

    // Extract all thinking content
    const thinking = matches.map((match) => match[1].trim()).join("\n\n");

    // Remove thinking tags from content
    const content = text.replace(thinkRegex, "").trim();

    return { thinking, content };
  };

  const getMessageText = (message: UIMessage) => {
    const fullText = message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part as MessagePart).text || "")
      .join("");

    // Extract and remove thinking content
    const { content } = extractThinkingContent(fullText);
    return content;
  };

  const getImageAttachments = (message: UIMessage) => {
    return message.parts.filter(
      (part) => "image" in part && part.image
    ) as unknown as Array<{
      type: "image";
      image: string | URL;
      mimeType?: string;
    }>;
  };

  const getReasoningPartsBeforeTools = (message: UIMessage) => {
    const reasoningParts: MessagePart[] = [];

    // Find the index of the first tool part
    const firstToolIndex = message.parts.findIndex(
      (part) => part.type.startsWith("tool-") || part.type === "dynamic-tool"
    );

    // If no tools, return all reasoning
    const partsToCheck =
      firstToolIndex === -1
        ? message.parts
        : message.parts.slice(0, firstToolIndex);

    partsToCheck.forEach((part) => {
      if (part.type === "reasoning") {
        reasoningParts.push(part as MessagePart);
      } else if (part.type === "text") {
        const { thinking } = extractThinkingContent(
          (part as MessagePart).text || ""
        );
        if (thinking) {
          reasoningParts.push({
            type: "reasoning",
            text: thinking,
            state: part.state,
          });
        }
      }
    });

    return reasoningParts;
  };

  const getReasoningPartsAfterTools = (message: UIMessage) => {
    const reasoningParts: MessagePart[] = [];

    // Find the index of the last tool part
    let lastToolIndex = -1;
    for (let i = message.parts.length - 1; i >= 0; i--) {
      if (
        message.parts[i].type.startsWith("tool-") ||
        message.parts[i].type === "dynamic-tool"
      ) {
        lastToolIndex = i;
        break;
      }
    }

    // If no tools, return empty
    if (lastToolIndex === -1) return [];

    const partsToCheck = message.parts.slice(lastToolIndex + 1);

    partsToCheck.forEach((part) => {
      if (part.type === "reasoning") {
        reasoningParts.push(part as MessagePart);
      } else if (part.type === "text") {
        const { thinking } = extractThinkingContent(
          (part as MessagePart).text || ""
        );
        if (thinking) {
          reasoningParts.push({
            type: "reasoning",
            text: thinking,
            state: part.state,
          });
        }
      }
    });

    return reasoningParts;
  };

  const hasReasoningPartsBeforeTools = (message: UIMessage) => {
    return getReasoningPartsBeforeTools(message).length > 0;
  };

  const hasReasoningPartsAfterTools = (message: UIMessage) => {
    return getReasoningPartsAfterTools(message).length > 0;
  };

  const getToolParts = (message: UIMessage) => {
    return message.parts.filter(
      (part) => part.type.startsWith("tool-") || part.type === "dynamic-tool"
    ) as MessagePart[];
  };

  const hasToolParts = (message: UIMessage) => {
    return message.parts.some(
      (part) => part.type.startsWith("tool-") || part.type === "dynamic-tool"
    );
  };

  return (
    <div className='flex-1 overflow-y-auto px-4 py-6'>
      <div className='max-w-4xl mx-auto space-y-6'>
        {messages.length === 0 && (
          <div className='text-center py-12'>
            <p className='text-zinc-600 dark:text-zinc-400'>
              What can I help you with today?
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {message.role === "assistant" && (
              <div className='w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0'>
                <Bot className='w-5 h-5 text-white' />
              </div>
            )}

            <div
              className={`rounded-2xl px-4 py-3 max-w-[80%] ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
              }`}
            >
              {message.role === "assistant" &&
                hasReasoningPartsBeforeTools(message) && (
                  <ReasoningSection
                    parts={getReasoningPartsBeforeTools(message)}
                  />
                )}
              {message.role === "assistant" && hasToolParts(message) && (
                <ToolUsageSection parts={getToolParts(message)} />
              )}
              {message.role === "assistant" &&
                hasReasoningPartsAfterTools(message) && (
                  <ReasoningSection
                    parts={getReasoningPartsAfterTools(message)}
                  />
                )}
              {/* Display image attachments */}
              {getImageAttachments(message).length > 0 && (
                <div className='mb-3 space-y-2'>
                  {getImageAttachments(message).map((img, idx) => (
                    <Image
                      key={idx}
                      src={
                        typeof img.image === "string"
                          ? img.image
                          : img.image.toString()
                      }
                      alt={`Attachment ${idx + 1}`}
                      width={500}
                      height={256}
                      className='max-w-full h-auto max-h-64 rounded-lg border border-zinc-200 dark:border-zinc-700 object-contain'
                      unoptimized
                    />
                  ))}
                </div>
              )}
              {message.role === "assistant" ? (
                <MarkdownMessage content={getMessageText(message)} />
              ) : (
                <p className='whitespace-pre-wrap'>{getMessageText(message)}</p>
              )}
            </div>

            {message.role === "user" && (
              <div className='w-8 h-8 rounded-full bg-zinc-300 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0'>
                <User className='w-5 h-5 text-zinc-700 dark:text-zinc-300' />
              </div>
            )}
          </div>
        ))}

        {isQueryingKnowledge && (
          <div className='flex gap-3 justify-start'>
            <div className='w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0'>
              <Database className='w-5 h-5 text-white' />
            </div>
            <div className='rounded-2xl px-4 py-3 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'>
              <div className='flex gap-2 items-center'>
                <span className='text-sm text-zinc-600 dark:text-zinc-400'>
                  Querying knowledge base
                </span>
                <div className='flex gap-1 items-center'>
                  <div className='w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]'></div>
                  <div className='w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]'></div>
                  <div className='w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce'></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {status === "submitted" && (
          <div className='flex gap-3 justify-start'>
            <div className='w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0'>
              <Bot className='w-5 h-5 text-white' />
            </div>
            <div className='rounded-2xl px-4 py-3 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'>
              <div className='flex gap-1 items-center h-6'>
                <div className='w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]'></div>
                <div className='w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]'></div>
                <div className='w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce'></div>
              </div>
            </div>
          </div>
        )}

        {status === "streaming" &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "assistant" && (
            <div className='flex gap-3 justify-start'>
              <div className='w-8 h-8 flex-shrink-0'></div>
              <div className='rounded-2xl px-4 py-3'>
                <div className='flex gap-1 items-center h-6'>
                  <div className='w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]'></div>
                  <div className='w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]'></div>
                  <div className='w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce'></div>
                </div>
              </div>
            </div>
          )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
