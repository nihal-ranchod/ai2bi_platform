const { openai } = require('../config/openai');

class EmbeddingService {
  constructor() {
    this.model = 'text-embedding-3-small';
    this.dimensions = 1536;
  }

  async createEmbedding(text) {
    try {
      const response = await openai.embeddings.create({
        model: this.model,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      throw new Error(`Error creating embedding: ${error.message}`);
    }
  }

  async createEmbeddings(texts) {
    try {
      const response = await openai.embeddings.create({
        model: this.model,
        input: texts,
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      throw new Error(`Error creating embeddings: ${error.message}`);
    }
  }
}

module.exports = { EmbeddingService };