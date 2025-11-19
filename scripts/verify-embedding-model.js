/**
 * Verification script to check if the embedding model is available in Ollama
 * Run with: node scripts/verify-embedding-model.js
 */

const OLLAMA_BASE_URL = 'http://192.168.0.155:11434';
const EMBEDDING_MODEL = 'nomic-embed-text'; // Current model from constants.ts

async function verifyModel() {
  console.log('🔍 Verifying Ollama setup...\n');

  // Check if Ollama server is reachable
  console.log(`Checking Ollama server at: ${OLLAMA_BASE_URL}`);
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      console.error('❌ Ollama server is not responding properly');
      console.error(`   Status: ${response.status}`);
      return false;
    }
    console.log('✅ Ollama server is reachable\n');

    const data = await response.json();
    const models = data.models || [];

    console.log(`📦 Available models (${models.length}):`);
    models.forEach((model) => {
      console.log(`   - ${model.name}`);
    });
    console.log();

    // Check if embedding model exists
    const embeddingModelExists = models.some((model) =>
      model.name.includes(EMBEDDING_MODEL)
    );

    if (embeddingModelExists) {
      console.log(`✅ Embedding model '${EMBEDDING_MODEL}' is available\n`);
    } else {
      console.log(`❌ Embedding model '${EMBEDDING_MODEL}' is NOT available\n`);
      console.log('To install the model, run:');
      console.log(`   ollama pull ${EMBEDDING_MODEL}\n`);
      return false;
    }

    // Test embedding generation
    console.log('🧪 Testing embedding generation...');
    const testText = 'This is a test sentence for embedding.';

    const embedResponse = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: testText,
      }),
    });

    if (!embedResponse.ok) {
      console.error('❌ Failed to generate test embedding');
      console.error(`   Status: ${embedResponse.status}`);
      const errorData = await embedResponse.json();
      console.error(`   Error:`, errorData);
      return false;
    }

    const embedData = await embedResponse.json();
    console.log(
      `✅ Successfully generated embedding (${embedData.embedding.length} dimensions)\n`
    );

    console.log('✨ All checks passed! The embedding system is ready.\n');
    return true;
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error(
        '\n💡 Make sure Ollama is running and accessible at the configured URL'
      );
    }
    return false;
  }
}

// Run verification
verifyModel()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
