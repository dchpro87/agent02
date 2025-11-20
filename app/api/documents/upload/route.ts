import { NextRequest } from "next/server";
import { ChromaClient } from "chromadb";
import { PDFParse } from "pdf-parse";
import {
  chunkText,
  generateChunkId,
  extractMetadata,
} from "@/lib/documentProcessing";
import {
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  MAX_BATCH_SIZE,
  CHROMA_MAX_BATCH,
} from "@/constants";

// Configure PDF.js worker for Node.js environment - use legacy build for Node.js
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

// Set worker to use the legacy worker which works in Node.js
GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.mjs",
  import.meta.url
).toString();

const chromaClient = new ChromaClient({
  path: "http://localhost:8000",
});

// Streaming upload endpoint with progress tracking
export async function PUT(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          if (controller.desiredSize !== null) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
            );
          }
        } catch {
          // Controller already closed, ignore
          console.log("[Streaming Upload] Cannot send message, stream closed");
        }
      };

      try {
        console.log("Streaming document upload request received");
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const collectionName = formData.get("collectionName") as string;

        if (!file) {
          send({ error: "No file provided", progress: 0 });
          controller.close();
          return;
        }

        if (!collectionName) {
          send({ error: "Collection name is required", progress: 0 });
          controller.close();
          return;
        }

        send({ status: "started", progress: 0, message: "Starting upload..." });

        // Get the collection
        let collection;
        try {
          collection = await chromaClient.getCollection({
            name: collectionName,
          });
          send({
            status: "collection_found",
            progress: 5,
            message: "Collection found",
          });
        } catch {
          send({
            error: `Collection "${collectionName}" not found`,
            progress: 0,
          });
          controller.close();
          return;
        }

        // Extract text
        let text = "";
        const fileType = file.type;
        const fileName = file.name;
        const fileSize = file.size;

        send({
          status: "extracting",
          progress: 10,
          message: "Extracting text...",
        });

        if (fileType === "application/pdf") {
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const pdfParser = new PDFParse({ data: uint8Array });
          const textResult = await pdfParser.getText();
          text = textResult.text;
          await pdfParser.destroy();
        } else if (fileType === "text/plain" || fileName.endsWith(".txt")) {
          text = await file.text();
        } else {
          send({ error: "Unsupported file type", progress: 0 });
          controller.close();
          return;
        }

        if (!text || text.trim().length === 0) {
          send({ error: "No text content found", progress: 0 });
          controller.close();
          return;
        }

        send({
          status: "chunking",
          progress: 15,
          message: "Creating chunks...",
        });

        // Split into chunks with optimized parameters
        const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
        const totalChunks = chunks.length;
        const timestamp = Date.now();

        send({
          status: "embedding",
          progress: 20,
          message: `Embedding ${totalChunks} chunks...`,
          totalChunks,
        });

        console.log(
          `[Streaming Upload] Starting batch embedding for ${totalChunks} chunks...`
        );

        // Generate embeddings using batch processing
        // For very large documents, process in smaller batches to avoid timeouts
        let embeddings: number[][] = [];

        if (totalChunks > MAX_BATCH_SIZE) {
          console.log(
            `[Streaming Upload] Large document detected (${totalChunks} chunks). Processing in batches of ${MAX_BATCH_SIZE}...`
          );

          const numBatches = Math.ceil(totalChunks / MAX_BATCH_SIZE);

          for (let batchIndex = 0; batchIndex < numBatches; batchIndex++) {
            const startIdx = batchIndex * MAX_BATCH_SIZE;
            const endIdx = Math.min(startIdx + MAX_BATCH_SIZE, totalChunks);
            const batchChunks = chunks.slice(startIdx, endIdx);

            console.log(
              `[Streaming Upload] Processing batch ${
                batchIndex + 1
              }/${numBatches} (chunks ${startIdx + 1}-${endIdx})`
            );

            send({
              status: "embedding",
              progress: 20 + Math.floor((batchIndex / numBatches) * 70),
              message: `Embedding batch ${batchIndex + 1}/${numBatches} (${
                batchChunks.length
              } chunks)...`,
              currentBatch: batchIndex + 1,
              totalBatches: numBatches,
            });

            try {
              const embeddingResponse = await fetch(
                `${request.nextUrl.origin}/api/generate-embedding`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ texts: batchChunks }),
                  signal: request.signal, // Propagate abort signal
                }
              );

              if (!embeddingResponse.ok) {
                const errorData = await embeddingResponse.json();
                throw new Error(
                  errorData.error || "Failed to generate embeddings"
                );
              }

              const embeddingData = await embeddingResponse.json();
              embeddings.push(...embeddingData.embeddings);

              console.log(
                `[Streaming Upload] Batch ${batchIndex + 1} complete: ${
                  embeddingData.embeddings.length
                } embeddings generated`
              );
            } catch (error) {
              if (error instanceof Error && error.name === "AbortError") {
                console.log("[Streaming Upload] Embedding cancelled by user");
                throw error;
              }
              throw error;
            }
          }

          console.log(
            `[Streaming Upload] All batches complete: ${embeddings.length} total embeddings`
          );
        } else {
          // Process all chunks at once for smaller documents
          try {
            const embeddingStartTime = Date.now();

            const embeddingResponse = await fetch(
              `${request.nextUrl.origin}/api/generate-embedding`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texts: chunks }),
                signal: request.signal, // Propagate abort signal
              }
            );

            console.log(
              `[Streaming Upload] Embedding response status: ${embeddingResponse.status}`
            );

            if (!embeddingResponse.ok) {
              let errorData;
              try {
                errorData = await embeddingResponse.json();
              } catch (parseError) {
                console.error(
                  "[Streaming Upload] Failed to parse error response:",
                  parseError
                );
                errorData = { error: "Failed to generate embeddings" };
              }
              console.error(
                "[Streaming Upload] Embedding error:",
                errorData.error
              );
              throw new Error(
                errorData.error || "Failed to generate embeddings"
              );
            }

            const embeddingData = await embeddingResponse.json();
            embeddings = embeddingData.embeddings;

            const embeddingDuration = Date.now() - embeddingStartTime;
            console.log(
              `[Streaming Upload] Successfully generated ${embeddings.length} embeddings in ${embeddingDuration}ms`
            );
          } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
              console.log("[Streaming Upload] Embedding cancelled by user");
              throw error;
            }
            throw error;
          }
        }

        // Validate embeddings
        if (!embeddings || embeddings.length !== totalChunks) {
          console.error(
            `[Streaming Upload] Embedding count mismatch: expected ${totalChunks}, got ${
              embeddings?.length || 0
            }`
          );
          throw new Error(
            `Embedding count mismatch: expected ${totalChunks}, got ${
              embeddings?.length || 0
            }`
          );
        }

        // Update progress to 90% after embeddings complete
        send({
          status: "embedding",
          progress: 90,
          message: `Successfully embedded ${totalChunks} chunks`,
        });

        send({
          status: "saving",
          progress: 90,
          message: "Saving to database...",
        });

        // Prepare data for ChromaDB
        const ids = chunks.map((_, index) =>
          generateChunkId(fileName, index, timestamp)
        );
        const metadatas = chunks.map((_, index) =>
          extractMetadata(fileName, fileType, fileSize, index, chunks.length)
        );

        // ChromaDB has a max batch size of ~5461 records
        // For large documents, we need to batch the add operation too
        // const CHROMA_MAX_BATCH = 5000; // Stay safely under the limit

        if (totalChunks > CHROMA_MAX_BATCH) {
          console.log(
            `[Streaming Upload] Large collection (${totalChunks} chunks). Saving in batches to ChromaDB...`
          );

          const numSaveBatches = Math.ceil(totalChunks / CHROMA_MAX_BATCH);

          for (let batchIndex = 0; batchIndex < numSaveBatches; batchIndex++) {
            const startIdx = batchIndex * CHROMA_MAX_BATCH;
            const endIdx = Math.min(startIdx + CHROMA_MAX_BATCH, totalChunks);

            console.log(
              `[Streaming Upload] Saving batch ${
                batchIndex + 1
              }/${numSaveBatches} to ChromaDB (records ${
                startIdx + 1
              }-${endIdx})`
            );

            send({
              status: "saving",
              progress: 90 + Math.floor((batchIndex / numSaveBatches) * 9),
              message: `Saving batch ${
                batchIndex + 1
              }/${numSaveBatches} to database...`,
            });

            await collection.add({
              ids: ids.slice(startIdx, endIdx),
              embeddings: embeddings.slice(startIdx, endIdx),
              documents: chunks.slice(startIdx, endIdx),
              metadatas: metadatas.slice(startIdx, endIdx),
            });

            console.log(
              `[Streaming Upload] Saved batch ${
                batchIndex + 1
              }/${numSaveBatches} successfully`
            );
          }

          console.log(
            `[Streaming Upload] All ${totalChunks} chunks saved to ChromaDB successfully`
          );
        } else {
          // Single batch for smaller documents
          await collection.add({
            ids,
            embeddings,
            documents: chunks,
            metadatas,
          });
        }

        send({
          status: "complete",
          progress: 100,
          message: `Successfully added ${chunks.length} chunks`,
          chunksAdded: chunks.length,
          fileName,
          fileSize,
        });

        controller.close();
      } catch (error) {
        // Handle abort/cancellation gracefully
        if (
          (error instanceof Error && error.name === "AbortError") ||
          request.signal.aborted
        ) {
          console.log("[Streaming Upload] Upload cancelled by user");
          send({
            error: "Upload cancelled",
            progress: 0,
          });
        } else {
          console.error("[Streaming Upload] Fatal error:", error);
          console.error(
            "[Streaming Upload] Error stack:",
            error instanceof Error ? error.stack : "No stack trace"
          );
          const errorMessage =
            error instanceof Error
              ? `${error.name}: ${error.message}`
              : "Upload failed";
          send({
            error: errorMessage,
            progress: 0,
          });
        }

        try {
          controller.close();
        } catch {
          // Already closed, ignore
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// export async function POST(request: NextRequest) {
//   try {
//     console.log("Document upload request received");
//     const formData = await request.formData();
//     const file = formData.get("file") as File;
//     const collectionName = formData.get("collectionName") as string;

//     console.log("File:", file?.name, "Collection:", collectionName);

//     if (!file) {
//       return NextResponse.json({ error: "No file provided" }, { status: 400 });
//     }

//     if (!collectionName) {
//       return NextResponse.json(
//         { error: "Collection name is required" },
//         { status: 400 }
//       );
//     }

//     // Get the collection
//     let collection;
//     try {
//       collection = await chromaClient.getCollection({ name: collectionName });
//       console.log("Collection retrieved successfully");
//     } catch {
//       return NextResponse.json(
//         { error: `Collection "${collectionName}" not found` },
//         { status: 404 }
//       );
//     }

//     // Extract text based on file type
//     let text = "";
//     const fileType = file.type;
//     const fileName = file.name;
//     const fileSize = file.size;

//     console.log("Processing file type:", fileType);

//     if (fileType === "application/pdf") {
//       // Process PDF
//       console.log("Parsing PDF...");
//       const arrayBuffer = await file.arrayBuffer();
//       const uint8Array = new Uint8Array(arrayBuffer);
//       const pdfParser = new PDFParse({ data: uint8Array });
//       const textResult = await pdfParser.getText();
//       text = textResult.text;
//       await pdfParser.destroy();
//       console.log("PDF parsed, text length:", text.length);
//     } else if (fileType === "text/plain" || fileName.endsWith(".txt")) {
//       // Process text file
//       text = await file.text();
//       console.log("Text file read, length:", text.length);
//     } else {
//       return NextResponse.json(
//         { error: "Unsupported file type. Please upload PDF or TXT files." },
//         { status: 400 }
//       );
//     }

//     if (!text || text.trim().length === 0) {
//       return NextResponse.json(
//         { error: "No text content found in the file" },
//         { status: 400 }
//       );
//     }

//     // Split text into chunks with optimized parameters
//     const chunks = chunkText(text, 1700, 250);
//     console.log(`Split into ${chunks.length} chunks`);
//     const timestamp = Date.now();

//     // Generate embeddings using batch processing for better performance
//     console.log(`Generating embeddings for all ${chunks.length} chunks...`);
//     let embeddings: number[][];
//     try {
//       const embeddingResponse = await fetch(
//         `${request.nextUrl.origin}/api/generate-embedding`,
//         {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ texts: chunks }),
//         }
//       );

//       if (!embeddingResponse.ok) {
//         const errorData = await embeddingResponse.json();
//         console.error("Embedding error:", errorData);
//         throw new Error(errorData.error || "Failed to generate embeddings");
//       }

//       const embeddingData = await embeddingResponse.json();
//       embeddings = embeddingData.embeddings;

//       console.log(
//         `Successfully generated ${embeddings.length} embeddings in batch`
//       );
//     } catch (error) {
//       console.error("Error generating embeddings:", error);
//       return NextResponse.json(
//         {
//           error: `Failed to generate embeddings for document chunks: ${
//             error instanceof Error ? error.message : "Unknown error"
//           }`,
//         },
//         { status: 500 }
//       );
//     }

//     console.log("All embeddings generated, adding to collection...");

//     // Prepare data for ChromaDB
//     const ids = chunks.map((_, index) =>
//       generateChunkId(fileName, index, timestamp)
//     );
//     const metadatas = chunks.map((_, index) =>
//       extractMetadata(fileName, fileType, fileSize, index, chunks.length)
//     );

//     // ChromaDB has a max batch size of ~5461 records
//     // For large documents, we need to batch the add operation too
//     const CHROMA_MAX_BATCH = 5000; // Stay safely under the limit
//     const totalChunks = chunks.length;

//     if (totalChunks > CHROMA_MAX_BATCH) {
//       console.log(
//         `Large collection (${totalChunks} chunks). Saving in batches to ChromaDB...`
//       );

//       const numSaveBatches = Math.ceil(totalChunks / CHROMA_MAX_BATCH);

//       for (let batchIndex = 0; batchIndex < numSaveBatches; batchIndex++) {
//         const startIdx = batchIndex * CHROMA_MAX_BATCH;
//         const endIdx = Math.min(startIdx + CHROMA_MAX_BATCH, totalChunks);

//         console.log(
//           `Saving batch ${
//             batchIndex + 1
//           }/${numSaveBatches} to ChromaDB (records ${startIdx + 1}-${endIdx})`
//         );

//         await collection.add({
//           ids: ids.slice(startIdx, endIdx),
//           embeddings: embeddings.slice(startIdx, endIdx),
//           documents: chunks.slice(startIdx, endIdx),
//           metadatas: metadatas.slice(startIdx, endIdx),
//         });
//       }

//       console.log(`All ${totalChunks} chunks saved to ChromaDB successfully`);
//     } else {
//       // Single batch for smaller documents
//       await collection.add({
//         ids,
//         embeddings,
//         documents: chunks,
//         metadatas,
//       });

//       console.log("Successfully added to collection");
//     }

//     return NextResponse.json({
//       success: true,
//       message: `Successfully added ${chunks.length} chunks from "${fileName}" to collection "${collectionName}"`,
//       chunksAdded: chunks.length,
//       fileName,
//       fileSize,
//     });
//   } catch (error) {
//     console.error("Document upload error:", error);
//     return NextResponse.json(
//       {
//         error:
//           error instanceof Error
//             ? error.message
//             : "Failed to process and upload document",
//       },
//       { status: 500 }
//     );
//   }
// }
