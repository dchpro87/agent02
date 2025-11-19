"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, RotateCcw, Database, X } from "lucide-react";
import MessageContainer from "./MessageContainer";
import ChatInput from "./ChatInput";
import ModelSelector from "./ModelSelector";
import SystemPromptSelector from "./SystemPromptSelector";
import ContextWindowManager from "./ContextWindowManager";
import { PREDEFINED_PROMPTS } from "@/lib/predefined-system-prompts";

export default function Chat() {
  const [inputValue, setInputValue] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("gemma3:1b");
  const [selectedPromptId, setSelectedPromptId] = useState<string>("default");
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [showContextManager, setShowContextManager] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(
    null
  );
  const [isQueryingKnowledge, setIsQueryingKnowledge] = useState(false);
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
          // Set default to gemma3:1b if available, otherwise use first model
          const defaultModel = sortedModels.includes("gemma3:1b")
            ? "gemma3:1b"
            : sortedModels[0];
          setSelectedModel(defaultModel);
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

    let contextDocuments: string[] = [];

    // If a collection is selected, perform RAG flow
    if (selectedCollection) {
      setIsQueryingKnowledge(true);
      try {
        // Step 1: Generate optimized search query from user message
        console.log("Generating search query from user message...");
        const queryResponse = await fetch("/api/generate-query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: inputValue,
            model: selectedModel,
          }),
        });

        if (!queryResponse.ok) {
          throw new Error("Failed to generate search query");
        }

        const { query: searchQuery } = await queryResponse.json();
        console.log("Generated search query:", searchQuery);

        // Step 2: Generate embedding from the search query
        // Using the same nomic-embed-text model that was used for document embeddings
        console.log("Generating embedding from search query...");
        const embeddingResponse = await fetch("/api/generate-embedding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: searchQuery,
          }),
        });

        if (!embeddingResponse.ok) {
          throw new Error("Failed to generate embedding");
        }

        const { embedding } = await embeddingResponse.json();
        console.log("Generated embedding:", embedding.length, "dimensions");

        // Step 3: Query ChromaDB with the generated embedding
        console.log("Querying ChromaDB for similar documents...");
        const chromaResponse = await fetch("/api/chroma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "query",
            name: selectedCollection,
            queryEmbeddings: [embedding],
            nResults: 5,
          }),
        });

        if (!chromaResponse.ok) {
          throw new Error("Failed to query ChromaDB");
        }

        const { results } = await chromaResponse.json();

        // Extract documents from results
        if (results.documents && results.documents[0]) {
          contextDocuments = results.documents[0];
          console.log("Found context documents:", contextDocuments.length);

          // Log distances for debugging retrieval quality
          if (results.distances && results.distances[0]) {
            console.log(
              "Document distances (lower is better):",
              results.distances[0]
            );
          }
        }
      } catch (error) {
        console.error("Error in RAG flow:", error);
        // Continue without context if RAG fails
      } finally {
        setIsQueryingKnowledge(false);
      }
    }

    // Step 4: Send message with context to LLM
    let messageText = inputValue;

    if (contextDocuments.length > 0) {
      // Prepend context to the message
      const contextSection = contextDocuments
        .map((doc, idx) => `[Context ${idx + 1}]: ${doc}`)
        .join("\n\n");

      messageText = `Based on the following context, please answer the user's question:

${contextSection}

User question: ${inputValue}`;
    }

    // Get the selected system prompt
    const selectedPrompt = PREDEFINED_PROMPTS.find(
      (p) => p.id === selectedPromptId
    );

    sendMessage(
      { text: messageText },
      {
        body: {
          model: selectedModel,
          systemPrompt: selectedPrompt?.prompt,
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
              <button
                onClick={() => setShowContextManager(!showContextManager)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  showContextManager
                    ? "bg-blue-500 hover:bg-blue-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                }`}
                title={
                  selectedCollection || "Click to select context collection"
                }
              >
                <Database className='w-4 h-4' />
                <span className='text-sm font-medium'>Context</span>
                {selectedCollection && (
                  <span className='w-2 h-2 rounded-full bg-green-400 animate-pulse'></span>
                )}
              </button>
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

          {/* System Prompt and Model Selection Row */}
          <div className='flex items-center gap-3 px-4 pb-3'>
            <SystemPromptSelector
              selectedPromptId={selectedPromptId}
              onPromptChange={setSelectedPromptId}
            />
            <ModelSelector
              models={models}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              isLoading={isLoadingModels}
            />
          </div>
        </div>
      </header>

      <div className='flex flex-1 overflow-hidden'>
        {/* Messages Container */}
        <div className='flex-1 flex flex-col overflow-hidden'>
          <MessageContainer
            messages={messages}
            status={status}
            isQueryingKnowledge={isQueryingKnowledge}
          />

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

        {/* Context Window Manager Sidebar */}
        {showContextManager && (
          <div className='w-96 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col'>
            <div className='flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800'>
              <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>
                Context Manager
              </h2>
              <button
                onClick={() => setShowContextManager(false)}
                className='p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors'
                title='Close context manager'
              >
                <X className='w-4 h-4' />
              </button>
            </div>
            <div className='flex-1 overflow-hidden p-4'>
              <ContextWindowManager
                selectedCollection={selectedCollection}
                onCollectionSelect={(collectionName) => {
                  setSelectedCollection(collectionName);
                  console.log("Selected collection:", collectionName);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
