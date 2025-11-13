import { Bot, User } from "lucide-react";
import { useEffect, useRef } from "react";

type Message = {
  id: string;
  role: "system" | "user" | "assistant";
  parts: Array<{ type: string; text?: string }>;
};

type MessageContainerProps = {
  messages: Message[];
  status: string;
};

export default function MessageContainer({
  messages,
  status,
}: MessageContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, status]);
  const getMessageText = (message: Message) => {
    return (
      message.parts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((part: any) => part.type === "text")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((part: any) => part.text)
        .join("")
    );
  };

  return (
    <div className='flex-1 overflow-y-auto px-4 py-6'>
      <div className='max-w-4xl mx-auto space-y-6'>
        {messages.length === 0 && (
          <div className='text-center py-12'>
            <p className='text-zinc-600 dark:text-zinc-400'>
              Ask me anything to get started
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
              <p className='whitespace-pre-wrap'>{getMessageText(message)}</p>
            </div>

            {message.role === "user" && (
              <div className='w-8 h-8 rounded-full bg-zinc-300 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0'>
                <User className='w-5 h-5 text-zinc-700 dark:text-zinc-300' />
              </div>
            )}
          </div>
        ))}

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
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
