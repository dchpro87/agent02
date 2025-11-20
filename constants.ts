export const OLLAMA_BASE_URL = "http://192.168.0.155:11434/api";

// Default embedding model - must be consistent across all embedding operations
export const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text"; // Model in Ollama

// Document processing constants
export const CHUNK_SIZE = 1700;
export const CHUNK_OVERLAP = 250;
export const MAX_BATCH_SIZE = 50;
export const CHROMA_MAX_BATCH = 5000; // Stay safely under the limit
