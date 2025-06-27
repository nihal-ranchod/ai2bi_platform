class RAGInterface {
    constructor() {
        this.initializeElements();
        this.attachEventListeners();
        this.loadStats();
    }

    initializeElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.uploadProgress = document.getElementById('uploadProgress');
        this.queryInput = document.getElementById('queryInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.analyzeBtn = document.getElementById('analyzeBtn');
        this.clearChatBtn = document.getElementById('clearChatBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.chatMessages = document.getElementById('chatMessages');
        this.docCount = document.getElementById('docCount');
        this.temperature = document.getElementById('temperature');
        this.tempValue = document.getElementById('tempValue');
        this.maxTokens = document.getElementById('maxTokens');
        this.retrievalLimit = document.getElementById('retrievalLimit');
        this.similarityThreshold = document.getElementById('similarityThreshold');
        this.thresholdValue = document.getElementById('thresholdValue');
        this.analysisModal = document.getElementById('analysisModal');
        this.analysisContent = document.getElementById('analysisContent');
        this.closeModal = document.getElementById('closeModal');
    }

    attachEventListeners() {
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        
        this.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        this.sendBtn.addEventListener('click', this.sendQuery.bind(this));
        this.analyzeBtn.addEventListener('click', this.analyzeQuery.bind(this));
        this.clearChatBtn.addEventListener('click', this.clearChat.bind(this));
        this.clearBtn.addEventListener('click', this.clearDocuments.bind(this));
        
        this.queryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendQuery();
        });
        
        this.temperature.addEventListener('input', () => {
            this.tempValue.textContent = this.temperature.value;
        });
        
        this.similarityThreshold.addEventListener('input', () => {
            this.thresholdValue.textContent = this.similarityThreshold.value;
        });
        
        this.closeModal.addEventListener('click', () => {
            this.analysisModal.style.display = 'none';
        });
        
        window.addEventListener('click', (e) => {
            if (e.target === this.analysisModal) {
                this.analysisModal.style.display = 'none';
            }
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        this.processFiles(files);
    }

    handleFileSelect(e) {
        const files = e.target.files;
        this.processFiles(files);
    }

    async processFiles(files) {
        for (let file of files) {
            await this.uploadFile(file);
        }
        this.loadStats();
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('document', file);

        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';
        progressItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${file.name}</span>
                <span>Uploading...</span>
            </div>
        `;
        this.uploadProgress.appendChild(progressItem);

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                progressItem.classList.add('success');
                progressItem.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>${file.name}</span>
                        <span>✓ ${result.chunks} chunks</span>
                    </div>
                `;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            progressItem.classList.add('error');
            progressItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${file.name}</span>
                    <span>✗ Error: ${error.message}</span>
                </div>
            `;
        }

        setTimeout(() => {
            progressItem.remove();
        }, 5000);
    }

    async sendQuery() {
        const query = this.queryInput.value.trim();
        if (!query) return;

        this.addMessage(query, 'user');
        this.queryInput.value = '';
        this.showTypingIndicator();

        const options = {
            temperature: parseFloat(this.temperature.value),
            maxTokens: parseInt(this.maxTokens.value),
            retrievalLimit: parseInt(this.retrievalLimit.value),
            similarityThreshold: parseFloat(this.similarityThreshold.value)
        };

        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query, options })
            });

            const result = await response.json();
            this.hideTypingIndicator();

            if (response.ok) {
                this.addMessage(result.response, 'bot', result.sources);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage(`Error: ${error.message}`, 'bot');
        }
    }

    async analyzeQuery() {
        const query = this.queryInput.value.trim();
        if (!query) {
            alert('Please enter a query to analyze');
            return;
        }

        try {
            const response = await fetch('/api/analyze-query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });

            const result = await response.json();

            if (response.ok) {
                this.showAnalysis(result);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            alert(`Error analyzing query: ${error.message}`);
        }
    }

    showAnalysis(analysis) {
        this.analysisContent.innerHTML = `
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; color: #4a5568;">Intent:</h4>
                <p style="background: #f7fafc; padding: 10px; border-radius: 8px;">${analysis.intent}</p>
            </div>
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; color: #4a5568;">Key Topics:</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${analysis.topics.map(topic => 
                        `<span style="background: #e2e8f0; padding: 5px 10px; border-radius: 15px; font-size: 0.9rem;">${topic}</span>`
                    ).join('')}
                </div>
            </div>
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; color: #4a5568;">Suggested Search Terms:</h4>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${analysis.searchTerms.map(term => 
                        `<span style="background: #bee3f8; padding: 5px 10px; border-radius: 15px; font-size: 0.9rem;">${term}</span>`
                    ).join('')}
                </div>
            </div>
            <div>
                <h4 style="margin-bottom: 10px; color: #4a5568;">Complexity Level:</h4>
                <p style="background: #f0fff4; padding: 10px; border-radius: 8px; color: #38a169;">${analysis.complexity}</p>
            </div>
        `;
        this.analysisModal.style.display = 'block';
    }

    addMessage(content, type, sources = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;

        const avatar = type === 'bot' ? 'fa-robot' : 'fa-user';
        
        let sourcesHtml = '';
        if (sources && sources.length > 0) {
            sourcesHtml = `
                <div class="sources">
                    <h4><i class="fas fa-bookmark"></i> Sources (${sources.length}):</h4>
                    ${sources.map(source => 
                        `<div class="source-item">
                            ${source.filename} (chunk ${source.chunk_index}, similarity: ${(source.similarity * 100).toFixed(1)}%)
                        </div>`
                    ).join('')}
                </div>
            `;
        }

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas ${avatar}"></i>
            </div>
            <div class="message-content">
                <p>${content}</p>
                ${sourcesHtml}
            </div>
        `;

        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span>Thinking</span>
                    <div class="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            </div>
        `;
        this.chatMessages.appendChild(typingDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    clearChat() {
        const messages = this.chatMessages.querySelectorAll('.message:not(.bot-message:first-child)');
        messages.forEach(msg => msg.remove());
    }

    async clearDocuments() {
        if (!confirm('Are you sure you want to clear all documents from the knowledge base?')) {
            return;
        }

        try {
            const response = await fetch('/api/documents', {
                method: 'DELETE'
            });

            const result = await response.json();

            if (response.ok) {
                this.loadStats();
                this.addMessage('All documents have been cleared from the knowledge base.', 'bot');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            alert(`Error clearing documents: ${error.message}`);
        }
    }

    async loadStats() {
        try {
            const response = await fetch('/api/stats');
            const stats = await response.json();

            if (response.ok) {
                this.docCount.textContent = stats.totalDocuments;
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RAGInterface();
});