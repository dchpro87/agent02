"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, RotateCcw } from "lucide-react";
import MessageContainer from "./MessageContainer";
import ChatInput from "./ChatInput";
import ModelSelector from "./ModelSelector";

export default function Chat() {
  const [inputValue, setInputValue] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("granite4");
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { messages, sendMessage, status, setMessages, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  useEffect(() => {
    if (status === "ready") {
      setAbortController(null);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [status]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch("/api/models");
        const data = await response.json();
        if (data.models && data.models.length > 0) {
          const sortedModels = [...data.models].sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: "base" })
          );
          setModels(sortedModels);
          setSelectedModel(sortedModels[0]);
        }
      } catch (error) {
        console.error("Failed to fetch models:", error);
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchModels();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || status !== "ready") return;

    const controller = new AbortController();
    setAbortController(controller);

    sendMessage(
      { text: inputValue },
      {
        body: {
          model: selectedModel,
        },
      }
    );
    setInputValue("");
  };

  const handleCancel = () => {
    console.log("Cancel clicked, abortController:", abortController);
    if (abortController) {
      console.log("Aborting request...");
      abortController.abort();
    }
    stop();
  };

  const handleReset = () => {
    setMessages([]);
    setInputValue("");
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className='flex flex-col h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black'>
      {/* Header */}
      <header className='border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm'>
        <div className='max-w-4xl mx-auto px-4 py-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center'>
                <Bot className='w-6 h-6 text-white' />
              </div>
              <div>
                <h1 className='text-xl font-semibold text-zinc-900 dark:text-zinc-100'>
                  AI Assistant
                </h1>
                <p className='text-sm text-zinc-500 dark:text-zinc-400'>
                  Powered by Ollama
                </p>
              </div>
            </div>
            <div className='flex items-center gap-3'>
              <ModelSelector
                models={models}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                isLoading={isLoadingModels}
              />
              <button
                onClick={handleReset}
                className='flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors'
                title='Reset conversation'
              >
                <RotateCcw className='w-4 h-4' />
                <span className='text-sm font-medium'>Reset</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Messages Container */}
      <MessageContainer messages={messages} status={status} />

      {/* Input Form */}
      <ChatInput
        inputValue={inputValue}
        setInputValue={setInputValue}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        status={status}
        inputRef={inputRef}
        isProcessing={status !== "ready" && status !== "error"}
      />
    </div>
  );
}
