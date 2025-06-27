const { supabase } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class VectorStore {
  constructor() {
    this.tableName = 'documents';
  }

  async addDocuments(documents) {
    try {
      const records = documents.map(doc => ({
        id: uuidv4(),
        content: doc.content,
        metadata: doc.metadata,
        embedding: doc.embedding
      }));

      const { data, error } = await supabase
        .from(this.tableName)
        .insert(records);

      if (error) {
        throw new Error(`Error inserting documents: ${error.message}`);
      }

      return data;
    } catch (error) {
      throw new Error(`Error adding documents to vector store: ${error.message}`);
    }
  }

  async similaritySearch(queryEmbedding, limit = 5, threshold = 0.3) {
    try {
      const { data, error } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        filter: {}
      });

      if (error) {
        throw new Error(`Error performing similarity search: ${error.message}`);
      }

      return data
        .filter(doc => doc.similarity >= threshold)
        .slice(0, limit)
        .map(doc => ({
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
          similarity: doc.similarity
        }));
    } catch (error) {
      throw new Error(`Error in similarity search: ${error.message}`);
    }
  }

  async deleteAllDocuments() {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .gt('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        throw new Error(`Error deleting documents: ${error.message}`);
      }

      return { success: true };
    } catch (error) {
      throw new Error(`Error deleting all documents: ${error.message}`);
    }
  }

  async getDocumentCount() {
    try {
      const { count, error } = await supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        throw new Error(`Error getting document count: ${error.message}`);
      }

      return count;
    } catch (error) {
      throw new Error(`Error getting document count: ${error.message}`);
    }
  }
}

module.exports = { VectorStore };