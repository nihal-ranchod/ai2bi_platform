# RAG AI Agent

A robust Retrieval Augmented Generation (RAG) AI agent built with OpenAI GPT-4o-mini and Supabase. This system allows you to upload documents and ask intelligent questions based on the content, with a modern professional web interface.

## Features

- **Document Processing**: Support for PDF, DOCX, and TXT files
- **Intelligent Chunking**: Automatic text splitting with overlap for better context retention
- **Vector Search**: Powered by Supabase's pgvector extension for semantic similarity search
- **AI Agent**: Uses GPT-4o-mini for query processing and response generation
- **Modern UI**: Professional, responsive web interface with drag-and-drop file upload
- **Real-time Stats**: Track document count and system status
- **Query Analysis**: Analyze user queries for better understanding
- **Configurable Settings**: Adjustable temperature, token limits, and retrieval parameters

## Prerequisites

- Node.js 16+
- Supabase account
- OpenAI API key

## Installation

1. **Clone or create the project**:
   ```bash
   cd /path/to/your/project
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up Supabase**:
   - Create a free account at [Supabase](https://supabase.com/)
   - Create a new project
   - Go to SQL Editor and run the following SQL:

   ```sql
   -- Enable the pgvector extension to work with embedding vectors
   create extension if not exists vector;

   -- Create a table to store your documents
   create table
     documents (
       id uuid primary key,
       content text, -- corresponds to Document.pageContent
       metadata jsonb, -- corresponds to Document.metadata
       embedding vector (1536) -- 1536 works for OpenAI embeddings, change if needed
     );

   -- Create a function to search for documents
   create function match_documents (
     query_embedding vector (1536),
     filter jsonb default '{}'
   ) returns table (
     id uuid,
     content text,
     metadata jsonb,
     similarity float
   ) language plpgsql as $$
   #variable_conflict use_column
   begin
     return query
     select
       id,
       content,
       metadata,
       1 - (documents.embedding <=> query_embedding) as similarity
     from documents
     where metadata @> filter
     order by documents.embedding <=> query_embedding;
   end;
   $$;
   ```

4. **Configure environment variables**:
   - Copy `.env.example` to `.env`
   - Add your API keys:

   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_SERVICE_KEY=your_supabase_service_key_here
   PORT=3000
   ```

5. **Start the server**:
   ```bash
   npm run dev
   ```

6. **Open your browser**:
   Navigate to `http://localhost:3000`

## Usage

1. **Upload Documents**: Drag and drop or click to upload PDF, DOCX, or TXT files
2. **Ask Questions**: Type your questions in the chat interface
3. **Review Sources**: See which document chunks were used to generate responses
4. **Adjust Settings**: Modify temperature, token limits, and retrieval parameters
5. **Analyze Queries**: Use the query analysis feature to understand your questions better

## API Endpoints

- `POST /api/upload` - Upload and process documents
- `POST /api/query` - Send queries to the AI agent
- `GET /api/stats` - Get knowledge base statistics
- `DELETE /api/documents` - Clear all documents
- `POST /api/analyze-query` - Analyze user queries

## Architecture

```
├── config/
│   ├── database.js      # Supabase configuration
│   └── openai.js        # OpenAI configuration
├── services/
│   ├── aiAgent.js       # Main AI agent logic
│   ├── documentProcessor.js # Document processing
│   ├── embeddingService.js  # OpenAI embeddings
│   ├── ragService.js    # RAG orchestration
│   └── vectorStore.js   # Supabase vector operations
├── utils/
│   └── textSplitter.js  # Text chunking utility
├── public/
│   ├── index.html       # Web interface
│   ├── styles.css       # Modern styling
│   └── script.js        # Frontend logic
└── server.js            # Express server
```

## Key Components

- **AIAgent**: Orchestrates the RAG pipeline using GPT-4o-mini
- **DocumentProcessor**: Handles PDF, DOCX, and TXT file processing
- **EmbeddingService**: Creates vector embeddings using OpenAI's text-embedding-3-small
- **VectorStore**: Manages document storage and similarity search in Supabase
- **RAGService**: Coordinates document ingestion and retrieval

## Security Features

- File type validation
- File size limits (10MB)
- Environment variable protection
- Input sanitization
- Error handling and logging

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License