import { NextRequest, NextResponse } from "next/server";
import { ChromaClient } from "chromadb";
import { PDFParse } from "pdf-parse";
import {
  chunkText,
  generateChunkId,
  extractMetadata,
} from "@/lib/documentProcessing";

// Configure PDF.js worker for Node.js environment - use legacy build for Node.js
import {
  getDocument,
  GlobalWorkerOptions,
} from "pdfjs-dist/legacy/build/pdf.mjs";

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
