// Model Database - Single Source of Truth for Model Capabilities
// This file contains comprehensive information about models available on Ollama

// Model capabilities interface
export interface ModelCapabilities {
  tools: boolean;
  vision: boolean;
  embedding: boolean;
  reasoning: boolean;
  contextSize: number;
  family: string;
  description?: string;
}

// Single source of truth for model information and capabilities
// This database contains information about models available on the Ollama server at 192.168.0.145:11434
// Last updated: July 8, 2025
export const MODEL_DATABASE: Record<string, ModelCapabilities> = {
  // DeepSeek R1 models - Advanced reasoning models
  "deepseek-r1:1.5b": {
    tools: false,
    vision: false,
    embedding: false,
    reasoning: true,
    contextSize: 128000,
    family: "deepseek",
    description: "Lightweight DeepSeek reasoning model",
  },
  "deepseek-r1:8b": {
    tools: true,
    vision: false,
    embedding: false,
    reasoning: true,
    contextSize: 128000,
    family: "deepseek",
    description: "8B parameter DeepSeek reasoning model",
  },

  // Gemma 3 models - Google's latest generation
  "gemma3n:latest": {
    tools: false,
    vision: false,
    embedding: false,
    reasoning: false,
    contextSize: 32000,
    family: "gemma",
    description:
      "Gemma 3n models are designed for efficient execution on everyday devices such as laptops, tablets or phones",
  },
  "gemma3:270m": {
    tools: false,
    vision: false,
    embedding: false,
    reasoning: false,
    contextSize: 32000,
    family: "gemma",
    description: "The current, most capable model that runs on a single GPU",
  },
  "gemma3:1b": {
    tools: false,
    vision: false,
    embedding: false,
    reasoning: false,
    contextSize: 32000,
    family: "gemma",
    description: "The current, most capable model that runs on a single GPU",
  },
  "gemma3:4b": {
    tools: false,
    vision: true,
    embedding: false,
    reasoning: false,
    contextSize: 128000,
    family: "gemma",
    description: "The current, most capable model that runs on a single GPU",
  },
  "gemma3:12b": {
    tools: false,
    vision: true,
    embedding: false,
    reasoning: false,
    contextSize: 128000,
    family: "gemma",
    description: "The current, most capable model that runs on a single GPU",
  },

  // OpenAI’s open-weight models designed for powerful reasoning, agentic tasks, and versatile developer use cases.
  "gpt-oss:20b": {
    tools: true,
    vision: false,
    embedding: false,
    reasoning: true,
    contextSize: 128000,
    family: "gpt-oss",
    description:
      "OpenAI's 20B parameter model for advanced reasoning and agentic tasks",
  },

  // A series of multimodal LLMs (MLLMs) designed for vision-language understanding.
  "minicpm-v:8b": {
    tools: false,
    vision: true,
    embedding: false,
    reasoning: false,
    contextSize: 32000,
    family: "minicpm",
    description: "MinicPM-V model with vision capabilities",
  },

  // Mistral AI's open-weight models known for high performance and efficiency.
  "mistral:latest": {
    tools: true,
    vision: false,
    embedding: false,
    reasoning: false,
    contextSize: 32000,
    family: "mistral",
    description: "The 7B model released by Mistral AI",
  },

  // Qwen models - Alibaba's multilingual models
  "qwen2.5vl:7b": {
    tools: false,
    vision: true,
    embedding: false,
    reasoning: false,
    contextSize: 125000,
    family: "qwen",
    description: "Qwen 2.5 with vision capabilities",
  },
  "qwen3-vl:8b": {
    tools: false,
    vision: true,
    embedding: false,
    reasoning: false,
    contextSize: 256000,
    family: "qwen",
    description:
      "The most powerful vision-language model in the Qwen model family to date",
  },
  "qwen2.5:3b": {
    tools: true,
    vision: false,
    embedding: false,
    reasoning: false,
    contextSize: 32000,
    family: "qwen",
    description: "Balanced Qwen 2.5 model",
  },
  "qwen2.5:0.5b": {
    tools: true,
    vision: false,
    embedding: false,
    reasoning: false,
    contextSize: 32000,
    family: "qwen",
    description: "Ultra-lightweight Qwen 2.5 model",
  },
  "qwen3:8b": {
    tools: true,
    vision: false,
    embedding: false,
    reasoning: true,
    contextSize: 40000,
    family: "qwen",
    description: "High-performance Qwen 3 model",
  },
  "qwen3:4b": {
    tools: true,
    vision: false,
    embedding: false,
    reasoning: true,
    contextSize: 40000,
    family: "qwen",
    description: "Balanced Qwen 3 model",
  },
  "qwen3:1.7b": {
    tools: true,
    vision: false,
    embedding: false,
    reasoning: true,
    contextSize: 40000,
    family: "qwen",
    description: "Compact Qwen 3 model",
  },
  "qwen3:0.6b": {
    tools: true,
    vision: false,
    embedding: false,
    reasoning: true,
    contextSize: 40000,
    family: "qwen",
    description: "Ultra-lightweight Qwen 3 model",
  },

  // Granite models - IBM's enterprise models
  "granite3.1-dense:latest": {
    tools: true,
    vision: false,
    embedding: false,
    reasoning: false,
    contextSize: 128000,
    family: "granite",
    description: "IBM's Granite dense model for enterprise use",
  },
  "granite4:latest": {
    tools: true,
    vision: false,
    embedding: false,
    reasoning: false,
    contextSize: 128000,
    family: "granite",
    description:
      "Granite 4 features improved instruction following (IF) and tool-calling capabilities, making them more effective in enterprise applications",
  },

  // Llama models
  "llama3.1:8b": {
    tools: true,
    vision: false,
    embedding: false,
    reasoning: false,
    contextSize: 128000,
    family: "llama3",
    description: "Balanced Llama 3.1 performance model",
  },
  "llama3.2:3b": {
    tools: true,
    vision: false,
    embedding: false,
    reasoning: false,
    contextSize: 128000,
    family: "llama3",
    description: "Compact Llama 3.2 with good performance",
  },
  "llama3.2:1b": {
    tools: true,
    vision: false,
    embedding: false,
    reasoning: false,
    contextSize: 128000,
    family: "llama3",
    description: "Lightweight Llama 3.2 for basic tasks",
  },
  "llama2:7b": {
    tools: false,
    vision: false,
    embedding: false,
    reasoning: false,
    contextSize: 4000,
    family: "llama2",
    description: "Previous generation Llama 2 model",
  },

  // Embedding models
  "nomic-embed-text:latest": {
    tools: false,
    vision: false,
    embedding: true,
    reasoning: false,
    contextSize: 8192,
    family: "nomic",
    description: "High-quality text embeddings for semantic search",
  },
} as const;
