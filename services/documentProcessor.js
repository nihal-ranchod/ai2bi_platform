const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { TextSplitter } = require('../utils/textSplitter');

class DocumentProcessor {
  constructor() {
    this.textSplitter = new TextSplitter(1000, 200);
  }

  async processFile(filePath, filename) {
    const ext = path.extname(filename).toLowerCase();
    let text = '';

    try {
      switch (ext) {
        case '.pdf':
          text = await this.processPDF(filePath);
          break;
        case '.docx':
          text = await this.processDocx(filePath);
          break;
        case '.txt':
          text = await this.processText(filePath);
          break;
        default:
          throw new Error(`Unsupported file type: ${ext}`);
      }

      const chunks = this.textSplitter.splitText(text);
      return chunks.map((chunk, index) => ({
        content: chunk,
        metadata: {
          filename,
          chunk_index: index,
          total_chunks: chunks.length,
          file_type: ext
        }
      }));
    } catch (error) {
      throw new Error(`Error processing file ${filename}: ${error.message}`);
    }
  }

  async processPDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  }

  async processDocx(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  async processText(filePath) {
    return fs.readFileSync(filePath, 'utf8');
  }
}

module.exports = { DocumentProcessor };