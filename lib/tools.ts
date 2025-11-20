import { tool } from "ai";
import { z } from "zod";
import { embed } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import { OLLAMA_BASE_URL, DEFAULT_EMBEDDING_MODEL } from "@/constants";
import { ChromaClient } from "chromadb";

const ollama = createOllama({
  baseURL: OLLAMA_BASE_URL,
});

const chromaClient = new ChromaClient({
  path: "http://localhost:8000",
});

/**
 * Tool to retrieve additional contextual information from ChromaDB knowledge base.
 * Queries a specified collection using semantic search to find relevant documents.
 */
export const createGetAdditionalContextTool = (defaultCollection?: string) =>
  tool({
    description:
      "Retrieve additional contextual information from the knowledge base by querying a semantic search query. Use this when you need more information about a topic that might be stored in the document collections.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "An optimized search query string to find similar documents (e.g., 'machine learning algorithms', 'company policies on remote work')"
        ),
    }),
    execute: async ({ query }) => {
      const collectionName = defaultCollection || "documents";
      console.log(
        `🔍 getAdditionalContext called with query: '${query}' on collection: '${collectionName}'`
      );
      try {
        // Generate embedding for the query
        const { embedding } = await embed({
          model: ollama.textEmbeddingModel(DEFAULT_EMBEDDING_MODEL),
          value: query,
        });

        // Query the ChromaDB collection
        const collection = await chromaClient.getCollection({
          name: collectionName,
        });

        // Perform the query
        const results = await collection.query({
          queryEmbeddings: [embedding],
          nResults: 5, // Return top 5 most relevant results
        });

        // Format the results
        if (
          !results.documents ||
          !results.documents[0] ||
          results.documents[0].length === 0
        ) {
          return {
            success: false,
            message: `No relevant documents found in collection '${collectionName}' for query: '${query}'`,
            results: [],
          };
        }

        const formattedResults = results.documents[0].map((doc, index) => {
          const metadata = results.metadatas?.[0]?.[index] || {};
          // Check for both camelCase and snake_case naming conventions
          const chunkIndex = metadata.chunkIndex ?? metadata.chunk_index;
          const totalChunks = metadata.totalChunks ?? metadata.total_chunks;

          let enhancedContent = doc || "";

          // Add chunk information header if available
          if (chunkIndex !== undefined && totalChunks !== undefined) {
            // const chunkNum = Number(chunkIndex) + 1; // Convert to 1-based indexing
            const chunkNum = Number(chunkIndex);
            const total = Number(totalChunks);

            enhancedContent = `[ChunkID ${chunkNum} of ${total}]\n\n${enhancedContent}`;

            // Add continuation note if not the last chunk
            if (chunkNum < total) {
              enhancedContent += `\n\n[Continues on chunkID ${
                chunkNum + 1
              } of ${total}]`;
            } else {
              enhancedContent += `\n\n[End of document]`;
            }
          }

          return {
            content: enhancedContent,
            metadata: metadata,
            distance: results.distances?.[0]?.[index],
          };
        });

        console.log(
          `✅ Formattedresults: ':${JSON.stringify(formattedResults, null, 2)}'`
        );

        return {
          success: true,
          collectionName,
          query,
          resultCount: formattedResults.length,
          results: formattedResults,
        };
      } catch (error) {
        console.error("getAdditionalContext error:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to retrieve context from knowledge base",
          collectionName,
          query,
        };
      }
    },
  });
