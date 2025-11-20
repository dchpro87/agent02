import { NextRequest, NextResponse } from "next/server";
import { ChromaClient } from "chromadb";

const chromaClient = new ChromaClient({
  path: "http://localhost:8000",
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get("action");

  try {
    switch (action) {
      case "list": {
        const collections = await chromaClient.listCollections();
        // Serialize collections to plain objects
        const serializedCollections = collections.map((col) => ({
          name: col.name,
          metadata: col.metadata,
        }));
        return NextResponse.json({ collections: serializedCollections });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Chroma API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to communicate with ChromaDB",
      },
      { status: 500 }
    );
  }
}

// Handle POST requests for creating collections and querying embeddings
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, name, metadata, queryEmbeddings, nResults } = body;

  try {
    switch (action) {
      case "create": {
        if (!name) {
          return NextResponse.json(
            { error: "Collection name is required" },
            { status: 400 }
          );
        }
        const collection = await chromaClient.createCollection({
          name,
          metadata,
        });
        return NextResponse.json({ collection: { name: collection.name } });
      }

      case "query": {
        if (!name) {
          return NextResponse.json(
            { error: "Collection name is required" },
            { status: 400 }
          );
        }
        if (
          !queryEmbeddings ||
          !Array.isArray(queryEmbeddings) ||
          queryEmbeddings.length === 0
        ) {
          return NextResponse.json(
            { error: "Query embeddings are required" },
            { status: 400 }
          );
        }

        const collection = await chromaClient.getCollection({ name });
        const results = await collection.query({
          queryEmbeddings,
          nResults: nResults || 5,
        });

        return NextResponse.json({ results });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Chroma API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to communicate with ChromaDB",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { name } = body;

  try {
    if (!name) {
      return NextResponse.json(
        { error: "Collection name is required" },
        { status: 400 }
      );
    }

    await chromaClient.deleteCollection({ name });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Chroma API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to communicate with ChromaDB",
      },
      { status: 500 }
    );
  }
}
