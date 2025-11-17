import { NextRequest, NextResponse } from "next/server";
import { ChromaClient } from "chromadb";
import { PDFParse } from "pdf-parse";
import {
  chunkText,
  generateChunkId,
  extractMetadata,
} from "@/lib/documentProcessing";

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

export async function POST(request: NextRequest) {
  try {
    console.log("Document upload request received");
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const collectionName = formData.get("collectionName") as string;

    console.log("File:", file?.name, "Collection:", collectionName);

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!collectionName) {
      return NextResponse.json(
        { error: "Collection name is required" },
        { status: 400 }
      );
    }

    // Get the collection
    let collection;
    try {
      collection = await chromaClient.getCollection({ name: collectionName });
      console.log("Collection retrieved successfully");
    } catch {
      return NextResponse.json(
        { error: `Collection "${collectionName}" not found` },
        { status: 404 }
      );
    }

    // Extract text based on file type
    let text = "";
    const fileType = file.type;
    const fileName = file.name;
    const fileSize = file.size;

    console.log("Processing file type:", fileType);

    if (fileType === "application/pdf") {
      // Process PDF
      console.log("Parsing PDF...");
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const pdfParser = new PDFParse({ data: uint8Array });
      const textResult = await pdfParser.getText();
      text = textResult.text;
      await pdfParser.destroy();
      console.log("PDF parsed, text length:", text.length);
    } else if (fileType === "text/plain" || fileName.endsWith(".txt")) {
      // Process text file
      text = await file.text();
      console.log("Text file read, length:", text.length);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload PDF or TXT files." },
        { status: 400 }
      );
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "No text content found in the file" },
        { status: 400 }
      );
    }

    // Split text into chunks
    const chunks = chunkText(text, 1000, 200);
    console.log(`Split into ${chunks.length} chunks`);
    const timestamp = Date.now();

    // Generate embeddings for each chunk
    const embeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        console.log(`Generating embedding for chunk ${i + 1}/${chunks.length}`);
        const embeddingResponse = await fetch(
          `${request.nextUrl.origin}/api/generate-embedding`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: chunk }),
          }
        );

        if (!embeddingResponse.ok) {
          const errorData = await embeddingResponse.json();
          console.error("Embedding error:", errorData);
          throw new Error(errorData.error || "Failed to generate embedding");
        }

        const embeddingData = await embeddingResponse.json();
        embeddings.push(embeddingData.embedding);
      } catch (error) {
        console.error("Error generating embedding for chunk:", error);
        return NextResponse.json(
          {
            error: `Failed to generate embeddings for document chunks: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          },
          { status: 500 }
        );
      }
    }

    console.log("All embeddings generated, adding to collection...");

    // Prepare data for ChromaDB
    const ids = chunks.map((_, index) =>
      generateChunkId(fileName, index, timestamp)
    );
    const metadatas = chunks.map((_, index) =>
      extractMetadata(fileName, fileType, fileSize, index, chunks.length)
    );

    // Add to collection
    await collection.add({
      ids,
      embeddings,
      documents: chunks,
      metadatas,
    });

    console.log("Successfully added to collection");

    return NextResponse.json({
      success: true,
      message: `Successfully added ${chunks.length} chunks from "${fileName}" to collection "${collectionName}"`,
      chunksAdded: chunks.length,
      fileName,
      fileSize,
    });
  } catch (error) {
    console.error("Document upload error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process and upload document",
      },
      { status: 500 }
    );
  }
}

// Streaming upload endpoint with progress tracking
export async function PUT(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
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

        // Split into chunks
        const chunks = chunkText(text, 1000, 100);
        const totalChunks = chunks.length;
        const timestamp = Date.now();

        send({
          status: "embedding",
          progress: 20,
          message: `Embedding ${totalChunks} chunks...`,
          totalChunks,
        });

        // Generate embeddings with progress updates
        const embeddings: number[][] = [];
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];

          const embeddingResponse = await fetch(
            `${request.nextUrl.origin}/api/generate-embedding`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: chunk }),
            }
          );

          if (!embeddingResponse.ok) {
            const errorData = await embeddingResponse.json();
            send({
              error: errorData.error || "Failed to generate embedding",
              progress: 0,
            });
            controller.close();
            return;
          }

          const embeddingData = await embeddingResponse.json();
          embeddings.push(embeddingData.embedding);

          // Calculate progress (20% to 90% for embedding phase)
          const embeddingProgress =
            20 + Math.floor(((i + 1) / totalChunks) * 70);
          send({
            status: "embedding",
            progress: embeddingProgress,
            currentChunk: i + 1,
            totalChunks,
            message: `Embedding chunk ${i + 1}/${totalChunks}...`,
          });
        }

        send({
          status: "saving",
          progress: 95,
          message: "Saving to database...",
        });

        // Prepare and add to collection
        const ids = chunks.map((_, index) =>
          generateChunkId(fileName, index, timestamp)
        );
        const metadatas = chunks.map((_, index) =>
          extractMetadata(fileName, fileType, fileSize, index, chunks.length)
        );

        await collection.add({
          ids,
          embeddings,
          documents: chunks,
          metadatas,
        });

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
        console.error("Streaming upload error:", error);
        send({
          error: error instanceof Error ? error.message : "Upload failed",
          progress: 0,
        });
        controller.close();
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
