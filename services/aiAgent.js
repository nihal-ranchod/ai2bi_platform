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
      const enhancedResponse = this.enhanceResponseForStructuredData(response, relevantDocs);

      return {
        response: enhancedResponse,
        sources: relevantDocs.map(doc => ({
          filename: doc.metadata.filename,
          similarity: doc.similarity,
          chunk_index: doc.metadata.chunk_index,
          chunk_type: doc.metadata.chunk_type,
          file_type: doc.metadata.file_type,
          sheet_index: doc.metadata.sheet_index
        })),
        retrievedDocs: relevantDocs.length,
        usage: completion.usage,
        dataInfo: this.extractDataInfo(relevantDocs)
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
4. Provide comprehensive yet well-structured answers
5. Maintain a professional and helpful tone
6. When working with structured data (CSV/Excel), format your responses with excellent readability

CRITICAL FORMATTING REQUIREMENTS:
- ALWAYS use proper markdown formatting for maximum readability
- Structure responses with clear headers (##, ###)
- Use tables for data comparisons and summaries
- Use bullet points and numbered lists for key insights
- Bold important findings and statistics
- Use code blocks for formulas or technical details

For structured data queries, ALWAYS include:
1. **Executive Summary** - Key findings in 2-3 bullet points
2. **Data Analysis** - Detailed findings with proper tables/charts
3. **Key Insights** - Important patterns, outliers, or trends
4. **Statistical Summary** - Relevant numbers, averages, totals
5. **Data Context** - Information about the dataset used

Formatting Standards:
- Headers: Use ## for main sections, ### for subsections
- Tables: Always include headers and align properly
- Numbers: Format large numbers with commas (e.g., 1,234,567)
- Percentages: Show percentages when relevant
- Emphasis: Use **bold** for key findings, *italic* for notes`;
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

  enhanceResponseForStructuredData(response, relevantDocs) {
    const hasStructuredData = relevantDocs.some(doc => 
      doc.metadata.file_type === 'csv' || doc.metadata.file_type === 'excel'
    );

    if (!hasStructuredData) {
      return response;
    }

    let enhancedResponse = response;
    
    // Add comprehensive data context section
    const dataFiles = relevantDocs.filter(doc => 
      doc.metadata.file_type === 'csv' || doc.metadata.file_type === 'excel'
    );

    if (dataFiles.length > 0) {
      enhancedResponse += "\n\n---\n\n## 📊 Data Sources\n\n";
      const uniqueFiles = [...new Set(dataFiles.map(doc => doc.metadata.filename))];
      
      uniqueFiles.forEach(filename => {
        const fileChunks = dataFiles.filter(doc => doc.metadata.filename === filename);
        const summaryChunk = fileChunks.find(doc => doc.metadata.chunk_type === 'summary');
        
        if (summaryChunk) {
          const fileType = summaryChunk.metadata.file_type.toUpperCase();
          const totalRows = summaryChunk.metadata.total_rows;
          const totalCols = summaryChunk.metadata.headers ? summaryChunk.metadata.headers.length : 0;
          
          enhancedResponse += `### ${filename}\n`;
          enhancedResponse += `- **Type:** ${fileType} file\n`;
          enhancedResponse += `- **Size:** ${totalRows.toLocaleString()} rows × ${totalCols} columns\n`;
          
          if (summaryChunk.metadata.headers) {
            enhancedResponse += `- **Columns:** ${summaryChunk.metadata.headers.join(', ')}\n`;
          }
          
          // Add sheets info for Excel
          if (summaryChunk.metadata.sheet_index !== null) {
            const sheets = fileChunks.map(chunk => chunk.metadata.sheet_index).filter(idx => idx !== null);
            const uniqueSheets = [...new Set(sheets)];
            if (uniqueSheets.length > 1) {
              enhancedResponse += `- **Sheets:** ${uniqueSheets.length} sheets analyzed\n`;
            }
          }
          
          enhancedResponse += `\n`;
        }
      });

      // Add analysis metadata
      enhancedResponse += `### Analysis Details\n`;
      enhancedResponse += `- **Documents retrieved:** ${relevantDocs.length}\n`;
      enhancedResponse += `- **Data chunks analyzed:** ${dataFiles.length}\n`;
      
      const hasLargeFiles = dataFiles.some(doc => doc.metadata.total_rows > 10000);
      if (hasLargeFiles) {
        enhancedResponse += `- **Note:** Large datasets detected - analysis based on representative samples\n`;
      }
    }

    return enhancedResponse;
  }

  extractDataInfo(relevantDocs) {
    const structuredDocs = relevantDocs.filter(doc => 
      doc.metadata.file_type === 'csv' || doc.metadata.file_type === 'excel'
    );

    if (structuredDocs.length === 0) {
      return null;
    }

    const dataInfo = {};
    
    structuredDocs.forEach(doc => {
      const filename = doc.metadata.filename;
      if (!dataInfo[filename]) {
        dataInfo[filename] = {
          fileType: doc.metadata.file_type,
          totalRows: doc.metadata.total_rows,
          headers: doc.metadata.headers,
          sheets: []
        };
      }

      if (doc.metadata.sheet_index !== null && doc.metadata.sheet_index !== undefined) {
        if (!dataInfo[filename].sheets.includes(doc.metadata.sheet_index)) {
          dataInfo[filename].sheets.push(doc.metadata.sheet_index);
        }
      }
    });

    return dataInfo;
  }
}

module.exports = { AIAgent };