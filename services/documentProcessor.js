const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const csv = require('csv-parser');
const xlsx = require('xlsx');
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
        case '.csv':
          return await this.processCSV(filePath, filename);
        case '.xlsx':
        case '.xls':
          return await this.processExcel(filePath, filename);
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

  async processCSV(filePath, filename) {
    return new Promise((resolve, reject) => {
      const results = [];
      let headers = [];
      let rowCount = 0;
      const maxRowsInMemory = 10000; // Process in batches for large files
      const sampleSize = 1000; // Sample for data analysis
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headerList) => {
          headers = headerList;
        })
        .on('data', (data) => {
          rowCount++;
          
          // Keep sample for analysis (first 1000 rows + random sampling)
          if (results.length < sampleSize || (rowCount % Math.max(1, Math.floor(rowCount / sampleSize)) === 0)) {
            results.push(data);
          }
          
          // Limit memory usage for very large files
          if (results.length > maxRowsInMemory) {
            results.shift(); // Remove oldest entry
          }
        })
        .on('end', () => {
          try {
            const structuredData = {
              headers,
              rows: results,
              totalRows: rowCount,
              summary: this.generateDataSummary(results, headers),
              isLargeFile: rowCount > maxRowsInMemory
            };

            const chunks = this.createStructuredChunks(structuredData, filename, 'csv');
            resolve(chunks);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  async processExcel(filePath, filename) {
    try {
      const workbook = xlsx.readFile(filePath, { 
        cellDates: true,
        cellNF: false,
        cellText: false
      });
      const allSheets = [];
      const maxRowsPerSheet = 10000;

      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const range = xlsx.utils.decode_range(worksheet['!ref'] || 'A1');
        const totalRows = range.e.r;
        
        // For large sheets, sample data
        const sampleRows = Math.min(maxRowsPerSheet, totalRows);
        const jsonData = xlsx.utils.sheet_to_json(worksheet, { 
          header: 1,
          range: totalRows > maxRowsPerSheet ? `A1:${xlsx.utils.encode_col(range.e.c)}${Math.min(1000, totalRows)}` : undefined
        });
        
        if (jsonData.length > 0) {
          const headers = jsonData[0] || [];
          const rows = jsonData.slice(1).map(row => {
            const obj = {};
            headers.forEach((header, index) => {
              obj[header] = row[index] || '';
            });
            return obj;
          });

          allSheets.push({
            sheetName,
            headers,
            rows,
            totalRows: totalRows,
            summary: this.generateDataSummary(rows, headers),
            isLargeFile: totalRows > maxRowsPerSheet
          });
        }
      });

      const chunks = [];
      allSheets.forEach((sheet, sheetIndex) => {
        const sheetChunks = this.createStructuredChunks(sheet, filename, 'excel', sheetIndex);
        chunks.push(...sheetChunks);
      });

      return chunks;
    } catch (error) {
      throw new Error(`Error processing Excel file: ${error.message}`);
    }
  }

  generateDataSummary(rows, headers) {
    const summary = {
      columnCount: headers.length,
      rowCount: rows.length,
      columns: {}
    };

    headers.forEach(header => {
      const values = rows.map(row => row[header]).filter(val => val !== undefined && val !== '');
      const uniqueValues = [...new Set(values)];
      
      summary.columns[header] = {
        totalValues: values.length,
        uniqueValues: uniqueValues.length,
        sampleValues: uniqueValues.slice(0, 5),
        dataType: this.inferDataType(values)
      };
    });

    return summary;
  }

  inferDataType(values) {
    if (values.length === 0) return 'empty';
    
    const numericValues = values.filter(val => !isNaN(val) && val !== '');
    if (numericValues.length === values.length) return 'numeric';
    
    const dateValues = values.filter(val => !isNaN(Date.parse(val)));
    if (dateValues.length === values.length) return 'date';
    
    return 'text';
  }

  createStructuredChunks(structuredData, filename, fileType, sheetIndex = null) {
    const chunks = [];
    const chunkSize = 50; // rows per chunk

    // Create summary chunk
    const summaryContent = this.formatStructuredSummary(structuredData, fileType, sheetIndex);
    chunks.push({
      content: summaryContent,
      metadata: {
        filename,
        chunk_index: 0,
        chunk_type: 'summary',
        file_type: fileType,
        sheet_index: sheetIndex,
        total_rows: structuredData.totalRows,
        headers: structuredData.headers
      }
    });

    // Create data chunks
    const rows = structuredData.rows || [];
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunkRows = rows.slice(i, i + chunkSize);
      const dataContent = this.formatStructuredData(chunkRows, structuredData.headers, fileType);
      
      chunks.push({
        content: dataContent,
        metadata: {
          filename,
          chunk_index: chunks.length,
          chunk_type: 'data',
          file_type: fileType,
          sheet_index: sheetIndex,
          row_start: i,
          row_end: Math.min(i + chunkSize - 1, rows.length - 1),
          total_rows: structuredData.totalRows,
          headers: structuredData.headers
        }
      });
    }

    return chunks;
  }

  formatStructuredSummary(data, fileType, sheetIndex) {
    let summary = `# ${fileType.toUpperCase()} File Analysis\n\n`;
    
    if (sheetIndex !== null && data.sheetName) {
      summary += `**Sheet:** ${data.sheetName}\n`;
    }
    
    summary += `**Total Rows:** ${data.totalRows.toLocaleString()}\n`;
    summary += `**Total Columns:** ${data.headers.length}\n`;
    
    if (data.isLargeFile) {
      summary += `**Note:** Large file detected - analysis based on representative sample\n`;
    }
    
    summary += `\n## Column Analysis\n\n`;
    
    // Create a formatted table of column information
    summary += `| Column | Type | Values | Unique | Sample Data |\n`;
    summary += `|--------|------|--------|--------|--------------|\n`;
    
    data.headers.forEach((header, index) => {
      const colData = data.summary.columns[header];
      const sampleStr = colData.sampleValues.slice(0, 3).join(', ');
      summary += `| ${header} | ${colData.dataType} | ${colData.totalValues} | ${colData.uniqueValues} | ${sampleStr} |\n`;
    });

    summary += `\n## Data Statistics\n\n`;
    
    // Add statistical insights
    const numericColumns = data.headers.filter(h => data.summary.columns[h].dataType === 'numeric');
    const textColumns = data.headers.filter(h => data.summary.columns[h].dataType === 'text');
    const dateColumns = data.headers.filter(h => data.summary.columns[h].dataType === 'date');
    
    summary += `- **Numeric columns:** ${numericColumns.length} (${numericColumns.join(', ')})\n`;
    summary += `- **Text columns:** ${textColumns.length} (${textColumns.join(', ')})\n`;
    summary += `- **Date columns:** ${dateColumns.length} (${dateColumns.join(', ')})\n`;

    return summary;
  }

  formatStructuredData(rows, headers, fileType) {
    const maxRows = Math.min(rows.length, 20); // Limit displayed rows
    let content = `## ${fileType.toUpperCase()} Data Sample (${maxRows} of ${rows.length} rows)\n\n`;

    // Create markdown table
    content += `| ${headers.join(' | ')} |\n`;
    content += `| ${headers.map(() => '---').join(' | ')} |\n`;

    rows.slice(0, maxRows).forEach(row => {
      const values = headers.map(header => {
        let value = row[header] || '';
        // Truncate long values
        if (typeof value === 'string' && value.length > 50) {
          value = value.substring(0, 47) + '...';
        }
        // Escape pipes in values
        return String(value).replace(/\|/g, '\\|');
      });
      content += `| ${values.join(' | ')} |\n`;
    });

    if (rows.length > maxRows) {
      content += `\n*... and ${rows.length - maxRows} more rows*\n`;
    }

    return content;
  }
}

module.exports = { DocumentProcessor };