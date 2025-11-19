import { tool } from "ai";
import { z } from "zod";

// Tool definitions for the AI assistant
// Each tool should have a clear description, input schema, and execute function

/**
 * Runtime context required for tools to execute
 */
export interface ToolContext {
  selectedCollection: string | null | undefined;
  ollamaBaseUrl: string;
}

/**
 * Factory function to create all tools with access to runtime dependencies
 * Add new tools here and they will automatically be included in the API route
 */
export function createTools(context: ToolContext) {
  return {
    getAdditionalContext: createGetAdditionalContextTool(context),
    // Add new tools here - they will be automatically included
    // Example: getWeather: createGetWeatherTool(context),
  };
}

/**
 * Factory function to create a getContext tool with access to runtime dependencies
 * This allows the tool to access the selected collection and API endpoints
 */
function createGetAdditionalContextTool(context: ToolContext) {
  const { ollamaBaseUrl } = context;

  return tool({
    description:
      "Retrieve relevant context and information from the knowledge base to help answer questions. Use this tool when you need additional information or context that might be stored in documents. The tool will search for and return relevant document chunks based on your search query and collection name.",
    inputSchema: z.object({
      collectionName: z
        .string()
        .describe(
          "The name of the knowledge base collection to search in. Use the collection name that the user has selected or mentioned."
        ),
      searchQuery: z
        .string()
        .describe(
          "An optimized search query to find relevant information in the knowledge base. Should be specific and focused on the key concepts needed to answer the user's question."
        ),
    }),
    execute: async ({ collectionName, searchQuery }) => {
      // Validation: Check collection name
      if (!collectionName || collectionName.trim().length === 0) {
        return JSON.stringify({
          status: "error",
          error_type: "no_collection",
          message: "Collection name is required but was not provided.",
          suggestion:
            "Please specify the collection name to search in. Ask the user which collection to use if uncertain.",
        });
      }

      // Validation: Check search query
      if (!searchQuery || searchQuery.trim().length === 0) {
        return JSON.stringify({
          status: "error",
          error_type: "invalid_query",
          message: "Search query cannot be empty.",
          suggestion:
            "Provide a meaningful search query based on the user's question.",
        });
      }

      console.log(`[getContext] Retrieving context for: "${searchQuery}"`);
      console.log(`[getContext] Collection: "${collectionName}"`);

      try {
        // Step 1: Generate embedding from the search query
        console.log("[getContext] Step 1: Generating embedding...");
        const embeddingResponse = await fetch(
          `${ollamaBaseUrl.replace(":11434", ":3000")}/api/generate-embedding`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: searchQuery }),
          }
        );

        if (!embeddingResponse.ok) {
          const errorData = await embeddingResponse.text();
          console.error("[getContext] Embedding generation failed:", errorData);
          return JSON.stringify({
            status: "error",
            error_type: "embedding_failed",
            message: "Failed to generate embedding for the search query.",
            details: `HTTP ${embeddingResponse.status}: ${errorData}`,
            suggestion:
              "The embedding service may be unavailable. Try rephrasing the question or inform the user about the technical issue.",
          });
        }

        const embeddingData = await embeddingResponse.json();

        if (
          !embeddingData.embedding ||
          !Array.isArray(embeddingData.embedding)
        ) {
          console.error(
            "[getContext] Invalid embedding response:",
            embeddingData
          );
          return JSON.stringify({
            status: "error",
            error_type: "invalid_embedding",
            message: "Received invalid embedding data.",
            suggestion:
              "There may be an issue with the embedding service. Try a different search query or inform the user.",
          });
        }

        const { embedding } = embeddingData;
        console.log(
          `[getContext] Embedding generated: ${embedding.length} dimensions`
        );

        // Step 2: Query ChromaDB with the generated embedding
        console.log("[getContext] Step 2: Querying ChromaDB...");
        const chromaResponse = await fetch(
          `${ollamaBaseUrl.replace(":11434", ":3000")}/api/chroma`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "query",
              name: collectionName,
              queryEmbeddings: [embedding],
              nResults: 5,
            }),
          }
        );

        if (!chromaResponse.ok) {
          const errorData = await chromaResponse.text();
          console.error("[getContext] ChromaDB query failed:", errorData);

          // Check if it's a collection not found error
          if (
            chromaResponse.status === 404 ||
            errorData.includes("does not exist")
          ) {
            return JSON.stringify({
              status: "error",
              error_type: "collection_not_found",
              message: `The collection "${collectionName}" was not found in the knowledge base.`,
              suggestion:
                "Ask the user to verify the collection name or select a different collection.",
            });
          }

          return JSON.stringify({
            status: "error",
            error_type: "database_query_failed",
            message: "Failed to query the knowledge base.",
            details: `HTTP ${chromaResponse.status}: ${errorData}`,
            suggestion:
              "The knowledge base may be unavailable. Inform the user and try again later.",
          });
        }

        const chromaData = await chromaResponse.json();

        if (!chromaData.results) {
          console.error("[getContext] Invalid ChromaDB response:", chromaData);
          return JSON.stringify({
            status: "error",
            error_type: "invalid_response",
            message: "Received invalid response from the knowledge base.",
            suggestion:
              "There may be a technical issue. Try a different search or inform the user.",
          });
        }

        const { results } = chromaData;

        // Extract documents from results
        if (
          !results.documents ||
          !results.documents[0] ||
          results.documents[0].length === 0
        ) {
          console.log("[getContext] No documents found for query");
          return JSON.stringify({
            status: "no_results",
            message: `No relevant information found in the knowledge base for: "${searchQuery}"`,
            searched_collection: collectionName,
            suggestion:
              "Try rephrasing the question, using different keywords, or inform the user that this information is not available in the current knowledge base. You can still answer based on your general knowledge if appropriate.",
          });
        }

        const contextDocuments = results.documents[0];
        const distances = results.distances?.[0] || [];

        console.log(`[getContext] Found ${contextDocuments.length} documents`);
        console.log(`[getContext] Relevance scores (distances):`, distances);

        // Check relevance quality (lower distance = more relevant)
        const avgDistance =
          distances.length > 0
            ? distances.reduce((a: number, b: number) => a + b, 0) /
              distances.length
            : null;

        const relevanceWarning =
          avgDistance && avgDistance > 1.0
            ? "\n\nNOTE: The retrieved documents may have low relevance to the query. Use this information cautiously and consider informing the user if the answer seems uncertain."
            : "";

        // Format the context documents with metadata
        const formattedContext = contextDocuments
          .map((doc: string, idx: number) => {
            const distance =
              distances[idx] !== undefined ? distances[idx].toFixed(3) : "N/A";
            return `[Source ${idx + 1}] (Relevance: ${distance}):\n${doc}`;
          })
          .join("\n\n");

        return JSON.stringify({
          status: "success",
          message: "Successfully retrieved context from knowledge base.",
          collection: collectionName,
          query_used: searchQuery,
          documents_found: contextDocuments.length,
          average_relevance: avgDistance?.toFixed(3) || "N/A",
          context: `${formattedContext}${relevanceWarning}`,
        });
      } catch (error) {
        console.error("[getContext] Unexpected error:", error);

        // Provide detailed error information
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        return JSON.stringify({
          status: "error",
          error_type: "unexpected_error",
          message: "An unexpected error occurred while retrieving context.",
          details: errorMessage,
          stack: errorStack,
          suggestion:
            "This is an unexpected technical issue. Inform the user that the knowledge base is temporarily unavailable and try to answer based on general knowledge if possible.",
        });
      }
    },
  });
}
