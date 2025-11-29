import { tool } from "ai";
import { z } from "zod";
import { embed } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import { OLLAMA_BASE_URL, DEFAULT_EMBEDDING_MODEL } from "@/constants";
import { ChromaClient } from "chromadb";
import { getJson } from "serpapi";

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
export const createGetAdditionalContextTool = (
  defaultCollection?: string,
  abortSignal?: AbortSignal
) =>
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
          abortSignal,
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

/**
 * Tool to perform web searches using SerpAPI.
 * Searches Google and returns relevant organic results with titles, links, and snippets.
 */
export const createWebSearchTool = () =>
  tool({
    description:
      "Search the web for current information, news, articles, or any topic not in the knowledge base. Use this when you need up-to-date information from the internet.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "The search query to look up on the web (e.g., 'latest AI developments', 'weather in Paris', 'TypeScript best practices 2024')"
        ),
      numResults: z
        .number()
        .optional()
        .default(5)
        .describe("Number of search results to return (1-10, default: 5)"),
    }),
    execute: async ({ query, numResults = 5 }) => {
      console.log(`🔍 webSearch called with query: '${query}'`);

      // Validate numResults
      const validNumResults = Math.min(Math.max(numResults, 1), 10);

      try {
        // Get API key from environment
        const apiKey = process.env.SERP_API_KEY;
        if (!apiKey) {
          return {
            success: false,
            error: "SERP_API_KEY is not configured in environment variables",
            query,
          };
        }

        // Perform the search using SerpAPI
        const response = await getJson({
          engine: "google",
          api_key: apiKey,
          q: query,
          num: validNumResults,
        });

        // Extract organic results
        const organicResults = response.organic_results || [];

        if (organicResults.length === 0) {
          return {
            success: false,
            message: `No search results found for query: '${query}'`,
            query,
            results: [],
          };
        }

        // Format the results
        const formattedResults = organicResults
          .slice(0, validNumResults)
          .map(
            (result: {
              position?: number;
              title?: string;
              link?: string;
              snippet?: string;
              displayed_link?: string;
            }) => ({
              position: result.position,
              title: result.title || "No title",
              link: result.link || "",
              snippet: result.snippet || "No description available",
              displayedLink: result.displayed_link || result.link || "",
            })
          );

        console.log(
          `✅ Web search completed: ${formattedResults.length} results found`
        );

        return {
          success: true,
          query,
          resultCount: formattedResults.length,
          results: formattedResults,
          searchMetadata: {
            searchTime: response.search_metadata?.total_time_taken,
            searchId: response.search_metadata?.id,
          },
        };
      } catch (error) {
        console.error("webSearch error:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to perform web search",
          query,
        };
      }
    },
  });
