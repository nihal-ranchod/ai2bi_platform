const { openai } = require('../config/openai');
const { RAGService } = require('./ragService');

class AIAgent {
  constructor() {
    this.ragService = new RAGService();
    this.model = 'gpt-4o-mini';
  }

  async processQuery(userQuery, options = {}) {
    try {
      const {
        temperature = 0.7,
        maxTokens = 1000,
        retrievalLimit = 5,
        similarityThreshold = 0.3
      } = options;

      const relevantDocs = await this.ragService.retrieve(
        userQuery, 
        retrievalLimit, 
        similarityThreshold
      );

      if (relevantDocs.length === 0) {
        return {
          response: "I couldn't find any relevant information in the knowledge base to answer your query. Please try rephrasing your question or upload relevant documents first.",
          sources: [],
          retrievedDocs: 0
        };
      }

      const context = this.buildContext(relevantDocs);
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt(userQuery, context);

      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens: maxTokens,
      });

      const response = completion.choices[0].message.content;

      return {
        response,
        sources: relevantDocs.map(doc => ({
          filename: doc.metadata.filename,
          similarity: doc.similarity,
          chunk_index: doc.metadata.chunk_index
        })),
        retrievedDocs: relevantDocs.length,
        usage: completion.usage
      };

    } catch (error) {
      throw new Error(`Error processing query: ${error.message}`);
    }
  }

  buildSystemPrompt() {
    return `You are a helpful AI assistant with access to a knowledge base through RAG (Retrieval Augmented Generation). 

Your responsibilities:
1. Answer user questions based on the provided context from the knowledge base
2. Be accurate and cite your sources when possible
3. If the context doesn't contain enough information, clearly state this
4. Provide comprehensive yet concise answers
5. Maintain a professional and helpful tone

Guidelines:
- Always base your answers on the provided context
- If you're unsure about something, express uncertainty rather than guessing
- When referencing information, mention which document or source it came from
- If the context is insufficient, suggest what additional information might be needed`;
  }

  buildUserPrompt(query, context) {
    return `Based on the following context from the knowledge base, please answer the user's question.

Context:
${context}

User Question: ${query}

Please provide a comprehensive answer based on the context above. If the context doesn't contain sufficient information to fully answer the question, please say so and suggest what additional information might be helpful.`;
  }

  buildContext(relevantDocs) {
    return relevantDocs
      .map((doc, index) => {
        const source = doc.metadata.filename || 'Unknown source';
        return `Source ${index + 1} (${source}):\n${doc.content}\n`;
      })
      .join('\n---\n\n');
  }

  async analyzeQuery(query) {
    try {
      const analysisPrompt = `Analyze the following user query and provide insights about:
1. Query intent (what is the user trying to achieve?)
2. Key topics/concepts mentioned
3. Suggested search terms for better retrieval
4. Query complexity level

Query: "${query}"

Provide a brief analysis in JSON format.`;

      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are a query analysis expert. Respond with valid JSON only.' },
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (error) {
      return {
        intent: 'Information seeking',
        topics: [query],
        searchTerms: [query],
        complexity: 'medium'
      };
    }
  }
}

module.exports = { AIAgent };