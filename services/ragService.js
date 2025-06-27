const { EmbeddingService } = require('./embeddingService');
const { VectorStore } = require('./vectorStore');
const { DocumentProcessor } = require('./documentProcessor');

class RAGService {
  constructor() {
    this.embeddingService = new EmbeddingService();
    this.vectorStore = new VectorStore();
    this.documentProcessor = new DocumentProcessor();
  }

  async ingestDocument(filePath, filename) {
    try {
      const chunks = await this.documentProcessor.processFile(filePath, filename);
      
      const texts = chunks.map(chunk => chunk.content);
      const embeddings = await this.embeddingService.createEmbeddings(texts);
      
      const documentsWithEmbeddings = chunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index]
      }));
      
      await this.vectorStore.addDocuments(documentsWithEmbeddings);
      
      return {
        success: true,
        message: `Successfully ingested ${chunks.length} chunks from ${filename}`,
        chunks: chunks.length
      };
    } catch (error) {
      throw new Error(`Error ingesting document: ${error.message}`);
    }
  }

  async retrieve(query, limit = 5, threshold = 0.3) {
    try {
      const queryEmbedding = await this.embeddingService.createEmbedding(query);
      const results = await this.vectorStore.similaritySearch(queryEmbedding, limit, threshold);
      
      return results.map(result => ({
        content: result.content,
        metadata: result.metadata,
        similarity: result.similarity
      }));
    } catch (error) {
      throw new Error(`Error retrieving documents: ${error.message}`);
    }
  }

  async getDocumentStats() {
    try {
      const count = await this.vectorStore.getDocumentCount();
      return { totalDocuments: count };
    } catch (error) {
      throw new Error(`Error getting document stats: ${error.message}`);
    }
  }

  async clearDocuments() {
    try {
      await this.vectorStore.deleteAllDocuments();
      return { success: true, message: 'All documents cleared successfully' };
    } catch (error) {
      throw new Error(`Error clearing documents: ${error.message}`);
    }
  }
}

module.exports = { RAGService };