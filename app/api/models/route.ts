import { OLLAMA_BASE_URL } from "@/constants";

export async function GET() {
  try {
    const response = await fetch(
      `${OLLAMA_BASE_URL.replace("/api", "")}/api/tags`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch models");
    }

    const data = await response.json();
    const models = data.models?.map((model: any) => model.name) || [];

    return Response.json({ models });
  } catch (error) {
    console.error("Error fetching models:", error);
    return Response.json({ models: [] }, { status: 500 });
  }
}
