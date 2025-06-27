class TextSplitter {
  constructor(chunkSize = 1000, chunkOverlap = 200) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  splitText(text) {
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
      let end = start + this.chunkSize;
      
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const splitPoint = Math.max(lastPeriod, lastNewline);
        
        if (splitPoint > start) {
          end = splitPoint + 1;
        }
      }
      
      chunks.push(text.slice(start, end).trim());
      start = end - this.chunkOverlap;
    }
    
    return chunks.filter(chunk => chunk.length > 0);
  }
}

module.exports = { TextSplitter };