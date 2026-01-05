/**
 * PDF Compressor - Client-Side PDF Compression using Ghostscript WASM
 * Clean OOP implementation with modular architecture
 */

// ============================================================================= //
// UTILITIES
// ============================================================================= //
const Utils = {
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    $(id) { return document.getElementById(id); },
    
    show(id) { this.$(id)?.classList.remove('hidden'); },
    hide(id) { this.$(id)?.classList.add('hidden'); },
    
    delay(ms) { return new Promise(r => setTimeout(r, ms)); }
};

// ============================================================================= //
// PDF RENDERER (PDF.js wrapper)
// ============================================================================= //
class PDFRenderer {
    constructor(canvasId, containerId) {
        this.canvas = Utils.$(canvasId);
        this.container = Utils.$(containerId);
        this.doc = null;
        this.currentPage = 1;
    }

    async load(source, startPage = 1) {
        const previousPage = this.currentPage;
        this.doc = await pdfjsLib.getDocument(source).promise;
        
        // Use startPage if provided, otherwise try to keep previous page (clamped to valid range)
        const targetPage = startPage > 1 ? startPage : Math.min(previousPage, this.doc.numPages);
        this.currentPage = targetPage;
        await this.renderPage(targetPage);
        return this.doc.numPages;
    }

    async renderPage(pageNum) {
        if (!this.doc) return;
        
        const page = await this.doc.getPage(pageNum);
        const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        const containerWidth = Math.max(this.container.clientWidth - 40, 800);
        const viewport = page.getViewport({ scale: 1.0 });
        const scale = containerWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        this.canvas.width = scaledViewport.width;
        this.canvas.height = scaledViewport.height;

        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        this.currentPage = pageNum;
        
        this.updatePageControls();
    }

    updatePageControls() {
        Utils.$('currentPage').textContent = this.currentPage;
        Utils.$('totalPages').textContent = this.doc?.numPages || 0;
        Utils.$('prevPageBtn').disabled = this.currentPage <= 1;
        Utils.$('nextPageBtn').disabled = this.currentPage >= (this.doc?.numPages || 0);
    }

    prevPage() {
        if (this.currentPage > 1) this.renderPage(this.currentPage - 1);
    }

    nextPage() {
        if (this.doc && this.currentPage < this.doc.numPages) {
            this.renderPage(this.currentPage + 1);
        }
    }

    clear() {
        const ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.canvas.width = this.canvas.height = 0;
        this.doc = null;
        this.currentPage = 1;
    }
}

// ============================================================================= //
// COMPRESSION WORKER MANAGER
// ============================================================================= //
class CompressionWorker {
    constructor(workerPath = 'compress-worker.js') {
        this.worker = null;
        this.workerPath = workerPath;
        this.messageId = 0;
        this.pendingRequests = new Map();
        this.isProcessing = false;
        this.queue = [];
    }

    init() {
        if (!this.worker) {
            console.log('Creating new compression worker...');
            this.worker = new Worker(this.workerPath, { type: 'module' });
            this.worker.onerror = (e) => console.error('Worker error:', e);
            
            // Single message handler that routes to correct promise
            this.worker.onmessage = async (e) => {
                const { messageId, status, compressedURL, originalSize, compressedSize, error } = e.data;
                
                const pending = this.pendingRequests.get(messageId);
                if (!pending) {
                    console.warn('Received message for unknown request:', messageId);
                    this.processNext();
                    return;
                }
                
                const { resolve, reject, blobURL } = pending;
                this.pendingRequests.delete(messageId);
                
                if (status === 'success') {
                    try {
                        const response = await fetch(compressedURL);
                        const buffer = await response.arrayBuffer();
                        URL.revokeObjectURL(blobURL);
                        URL.revokeObjectURL(compressedURL);
                        resolve({ buffer, originalSize, compressedSize });
                    } catch (err) {
                        URL.revokeObjectURL(blobURL);
                        reject(err);
                    }
                } else {
                    URL.revokeObjectURL(blobURL);
                    reject(new Error(error));
                }
                
                // Process next item in queue
                this.processNext();
            };
        }
        return this;
    }

    // Terminate and reset worker for fresh state
    reset() {
        if (this.worker) {
            console.log('Terminating worker for fresh state...');
            this.worker.terminate();
            this.worker = null;
        }
        this.messageId = 0;
        this.pendingRequests.clear();
        this.isProcessing = false;
        this.queue = [];
    }

    processNext() {
        this.isProcessing = false;
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            this.executeCompress(next.fileBuffer, next.quality, next.customDPI, next.resolve, next.reject);
        }
    }

    executeCompress(fileBuffer, quality, customDPI, resolve, reject) {
        this.isProcessing = true;
        const messageId = ++this.messageId;
        const blob = new Blob([fileBuffer], { type: 'application/pdf' });
        const blobURL = URL.createObjectURL(blob);
        
        // Store the promise handlers with the blob URL
        this.pendingRequests.set(messageId, { resolve, reject, blobURL });

        this.worker.postMessage({ messageId, psDataURL: blobURL, quality, customDPI });
    }

    compress(fileBuffer, quality, customDPI = null) {
        return new Promise((resolve, reject) => {
            // If already processing, queue this request
            if (this.isProcessing) {
                console.log(`Queueing compression for ${quality} (worker busy)`);
                this.queue.push({ fileBuffer, quality, customDPI, resolve, reject });
                return;
            }
            
            this.executeCompress(fileBuffer, quality, customDPI, resolve, reject);
        });
    }
}

// ============================================================================= //
// PREVIEW CACHE
// ============================================================================= //
class PreviewCache {
    constructor() {
        this.cache = new Map();
    }

    generateKey(quality) {
        return quality;
    }

    has(key) { return this.cache.has(key); }
    
    get(key) { return this.cache.get(key); }
    
    set(key, blob, url) {
        this.cache.set(key, { blob, url });
    }

    clear() {
        this.cache.forEach(({ url }) => URL.revokeObjectURL(url));
        this.cache.clear();
    }
}

// ============================================================================= //
// UI MANAGER
// ============================================================================= //
class UIManager {
    constructor() {
        this.loadingOverlay = null;
    }

    updateProgress(percent, text) {
        const bar = Utils.$('progressBar');
        const pct = Utils.$('progressPercent');
        const txt = Utils.$('progressText');
        
        if (bar) bar.style.width = `${percent}%`;
        if (pct) pct.textContent = `${percent}%`;
        if (txt) txt.textContent = text;
    }

    updateLoading(text, percent) {
        Utils.$('loadingText').textContent = text;
        Utils.$('loadingBar').style.width = `${percent}%`;
    }

    showPreviewLoading() {
        const container = Utils.$('previewSection')?.querySelector('.bg-white');
        if (!container) return;

        this.loadingOverlay = document.createElement('div');
        this.loadingOverlay.id = 'previewLoadingOverlay';
        this.loadingOverlay.className = 'absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center rounded-lg';
        this.loadingOverlay.innerHTML = `
            <div class="text-center">
                <svg class="animate-spin h-12 w-12 text-purple-600 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-lg font-medium text-gray-800">Generating preview...</p>
            </div>
        `;
        container.style.position = 'relative';
        container.appendChild(this.loadingOverlay);
    }

    hidePreviewLoading() {
        this.loadingOverlay?.remove();
        this.loadingOverlay = null;
    }

    displayResults(original, compressed) {
        const saved = original - compressed;
        const percent = ((saved / original) * 100).toFixed(1);
        
        Utils.$('resultOriginalSize').textContent = Utils.formatFileSize(original);
        Utils.$('resultCompressedSize').textContent = Utils.formatFileSize(compressed);
        Utils.$('resultSavedPercent').textContent = `${percent}% reduced`;
        
        Utils.show('resultSection');
    }

    setQualityActive(element) {
        document.querySelectorAll('.quality-option').forEach(opt => {
            opt.classList.remove('border-purple-500', 'bg-purple-50');
            if (!opt.classList.contains('quality-locked')) {
                opt.classList.add('border-gray-300');
            }
        });
        element.classList.add('border-purple-500', 'bg-purple-50');
        element.classList.remove('border-gray-300');
    }

    // Lock a quality option (show loading spinner)
    lockQuality(quality) {
        const opt = document.querySelector(`[data-quality="${quality}"]`);
        if (!opt) return;
        
        opt.classList.add('quality-locked', 'opacity-60', 'cursor-not-allowed');
        opt.classList.remove('cursor-pointer', 'hover:border-purple-500');
        
        const loading = opt.querySelector('.quality-loading');
        const radio = opt.querySelector('.quality-radio');
        if (loading) loading.classList.remove('hidden');
        if (radio) radio.classList.add('hidden');
    }

    // Unlock a quality option (show radio, hide spinner)
    unlockQuality(quality, sizeText = null) {
        const opt = document.querySelector(`[data-quality="${quality}"]`);
        if (!opt) return;
        
        opt.classList.remove('quality-locked', 'opacity-60', 'cursor-not-allowed');
        opt.classList.add('cursor-pointer', 'hover:border-purple-500');
        
        const loading = opt.querySelector('.quality-loading');
        const radio = opt.querySelector('.quality-radio');
        if (loading) loading.classList.add('hidden');
        if (radio) radio.classList.remove('hidden');
        
        // Update hint with file size if provided
        if (sizeText) {
            const hint = opt.querySelector('.quality-hint');
            if (hint) hint.textContent = sizeText;
        }
    }

    // Lock all compression quality options (not original)
    lockAllQualities() {
        ['low', 'medium', 'good', 'high', 'best'].forEach(q => this.lockQuality(q));
    }

    // Reset quality hints to default
    resetQualityHints() {
        const defaults = {
            low: 'Smallest file',
            medium: 'Recommended',
            good: 'Balanced',
            high: 'Better quality',
            best: 'Print quality',
            original: 'Keep as-is'
        };
        Object.entries(defaults).forEach(([quality, text]) => {
            const opt = document.querySelector(`[data-quality="${quality}"]`);
            const hint = opt?.querySelector('.quality-hint');
            if (hint) hint.textContent = text;
        });
    }
}

// ============================================================================= //
// MAIN PDF COMPRESSOR CLASS
// ============================================================================= //
class PDFCompressor {
    constructor() {
        this.file = null;
        this.compressedBlob = null;
        this.quality = 'original';
        this.previewRequestId = 0;  // Track current request to prevent race conditions
        this.preloadPaused = false;  // Pause background preloading during user interaction
        this.pendingQualities = new Set();  // Track qualities currently being processed
        this.isPreloading = false;  // Prevent concurrent preload loops
        
        this.renderer = new PDFRenderer('pdfCanvas', 'pdfViewerContainer');
        this.worker = new CompressionWorker();
        this.cache = new PreviewCache();
        this.ui = new UIManager();
        
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => this.bindEvents());
    }

    bindEvents() {
        Utils.$('pdfFile').addEventListener('change', (e) => this.handleFile(e));
        Utils.$('compressBtn').addEventListener('click', () => this.save());
        Utils.$('downloadBtn').addEventListener('click', () => this.download());
        Utils.$('resetBtn').addEventListener('click', () => this.reset());
        Utils.$('prevPageBtn').addEventListener('click', () => this.renderer.prevPage());
        Utils.$('nextPageBtn').addEventListener('click', () => this.renderer.nextPage());
        
        this.setupDragDrop();
        this.setupQualitySelection();
    }

    setupDragDrop() {
        const zone = Utils.$('dropZone');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => {
            zone.addEventListener(e, (ev) => { ev.preventDefault(); ev.stopPropagation(); });
        });

        ['dragenter', 'dragover'].forEach(e => {
            zone.addEventListener(e, () => zone.classList.add('border-purple-500', 'bg-purple-50'));
        });

        ['dragleave', 'drop'].forEach(e => {
            zone.addEventListener(e, () => zone.classList.remove('border-purple-500', 'bg-purple-50'));
        });

        zone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files.length) {
                Utils.$('pdfFile').files = e.dataTransfer.files;
                this.handleFile({ target: Utils.$('pdfFile') });
            }
        });
    }

    setupQualitySelection() {
        document.querySelectorAll('.quality-option').forEach(opt => {
            opt.addEventListener('click', () => {
                // Don't allow clicking on locked options
                if (opt.classList.contains('quality-locked')) {
                    console.log('Quality option is locked, ignoring click');
                    return;
                }
                
                this.ui.setQualityActive(opt);
                const radio = opt.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = true;
                    this.quality = radio.value;
                    console.log('Quality changed to:', this.quality);
                    if (this.file) {
                        this.handleQualityChange();
                    }
                }
            });
        });
    }

    handleQualityChange() {
        const cacheKey = this.getCacheKey();
        
        // Always pause background preloading when user interacts
        this.preloadPaused = true;
        
        // Cancel any pending load and hide loading overlay
        this.previewRequestId++;
        this.ui.hidePreviewLoading();
        
        // If cached, show immediately then resume background loading
        if (this.cache.has(cacheKey)) {
            console.log('Cached, showing immediately:', this.quality);
            this.showCachedPreview(cacheKey);
            return;
        }
        
        // Not cached - load this quality with priority
        console.log('Not cached, loading with priority:', this.quality);
        this.loadQualityWithPriority();
    }

    async showCachedPreview(cacheKey) {
        try {
            const cached = this.cache.get(cacheKey);
            Utils.show('previewSection');
            Utils.show('compressBtn');
            await this.renderer.load(cached.url);
            this.updatePreviewSize(cached.blob?.size || cached.size);
        } catch (e) {
            console.error('Error showing cached preview:', e);
        }
        
        // Resume background preloading (restart if it was stopped)
        this.preloadPaused = false;
        this.preloadAllQualities();
    }

    async loadQualityWithPriority() {
        const requestId = this.previewRequestId;  // Don't increment - already done in handleQualityChange
        const quality = this.quality;
        const isOutdated = () => requestId !== this.previewRequestId;
        
        // Show loading overlay
        this.ui.showPreviewLoading();
        
        try {
            this.worker.init();
            const fileBuffer = await this.file.arrayBuffer();
            
            if (isOutdated()) {
                console.log('Request outdated before compression');
                this.ui.hidePreviewLoading();
                return;
            }
            
            const { buffer } = await this.worker.compress(fileBuffer, quality, null);
            
            // Always cache the result - it's useful even if user switched away
            const blob = new Blob([buffer], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            this.cache.set(quality, blob, url);
            
            if (isOutdated()) {
                console.log('Request outdated after compression, cached for later');
                this.ui.hidePreviewLoading();
                return;
            }
            
            // Show the result
            Utils.show('previewSection');
            Utils.show('compressBtn');
            await this.renderer.load(url);
            
            if (isOutdated()) {
                this.ui.hidePreviewLoading();
                return;
            }
            
            this.updatePreviewSize(blob.size);
            this.ui.hidePreviewLoading();
            
            // Also unlock this quality in the UI
            this.ui.unlockQuality(quality, Utils.formatFileSize(blob.size));
            
            // Resume background preloading (only starts if not already running)
            this.preloadPaused = false;
            this.preloadAllQualities();
            
        } catch (error) {
            this.ui.hidePreviewLoading();
            if (!isOutdated()) {
                alert('Preview generation failed: ' + error.message);
            }
        }
    }

    validateFile(file) {
        if (file.type !== 'application/pdf') {
            alert('Please select a PDF file');
            return false;
        }
        if (file.size > 50 * 1024 * 1024) {
            alert('File size exceeds 50MB limit');
            return false;
        }
        return true;
    }

    async handleFile(event) {
        const file = event.target.files[0];
        if (!file || !this.validateFile(file)) return;

        // Invalidate all pending preview requests
        this.previewRequestId++;
        this.preloadPaused = false;
        this.pendingQualities.clear();  // Clear pending tracking
        this.isPreloading = false;  // Allow new preload to start
        
        // Reset worker for fresh WASM state
        this.worker.reset();
        
        this.file = file;
        this.cache.clear();
        this.renderer.clear();
        
        // Hide any stuck loading overlay
        this.ui.hidePreviewLoading();
        
        // Lock all compression options and reset hints
        this.ui.lockAllQualities();
        this.ui.resetQualityHints();

        // Reset quality to original and update UI selection
        this.quality = 'original';
        const defaultOpt = document.querySelector('[data-quality="original"]');
        if (defaultOpt) this.ui.setQualityActive(defaultOpt);

        this.showInitialUI();
        this.ui.updateLoading('Loading file...', 50);
        await Utils.delay(100);

        Utils.$('originalName').textContent = file.name;
        Utils.$('originalSize').textContent = Utils.formatFileSize(file.size);

        // Show original preview immediately (no compression needed)
        const originalUrl = URL.createObjectURL(file);
        const originalBlob = file;
        this.cache.set('original', originalBlob, originalUrl);

        this.ui.updateLoading('Loading preview...', 80);
        
        Utils.show('previewSection');
        Utils.show('compressBtn');
        await this.renderer.load(originalUrl);
        this.updatePreviewSize(file.size);

        this.ui.updateLoading('Complete!', 100);
        await Utils.delay(200);

        this.showReadyUI();

        // Preload all quality options in background
        this.preloadAllQualities();
    }

    async preloadAllQualities() {
        // Prevent concurrent preload loops
        if (this.isPreloading) {
            console.log('Preload already in progress, skipping');
            return;
        }
        
        const qualities = ['low', 'medium', 'fair', 'good', 'high'];
        const currentFile = this.file; // Track which file we're preloading for
        
        // Check if all qualities are already cached
        const allCached = qualities.every(q => this.cache.has(q));
        if (allCached) {
            console.log('All qualities already cached');
            return;
        }
        
        this.isPreloading = true;
        this.worker.init();
        
        const fileBuffer = await currentFile.arrayBuffer();
        
        // Helper to unlock all uncached qualities when stopping early
        const unlockRemaining = () => {
            for (const q of qualities) {
                if (!this.cache.has(q)) {
                    this.ui.unlockQuality(q, 'Click to load');
                }
            }
        };
        
        for (const quality of qualities) {
            // Stop if file changed
            if (this.file !== currentFile) {
                console.log('File changed, stopping preload');
                unlockRemaining();
                this.isPreloading = false;
                return;
            }
            
            // Pause if user is interacting with quality options
            if (this.preloadPaused) {
                console.log('Preload paused, stopping');
                unlockRemaining();
                this.isPreloading = false;
                return;
            }
            
            // Skip if already cached
            if (this.cache.has(quality)) {
                // Still unlock it in case UI wasn't updated
                const cached = this.cache.get(quality);
                this.ui.unlockQuality(quality, Utils.formatFileSize(cached.blob?.size || 0));
                continue;
            }
            
            // Skip if already being processed (prevents duplicate queueing)
            if (this.pendingQualities.has(quality)) {
                console.log(`Skipping ${quality} - already in progress`);
                continue;
            }
            
            try {
                console.log(`Preloading ${quality}...`);
                this.pendingQualities.add(quality);  // Mark as in progress
                
                const { buffer } = await this.worker.compress(fileBuffer, quality, null);
                
                this.pendingQualities.delete(quality);  // Remove from pending
                
                // Check again after compression
                if (this.file !== currentFile || this.preloadPaused) {
                    console.log('File changed or paused during compression, discarding result');
                    // Unlock all remaining uncached qualities
                    unlockRemaining();
                    this.isPreloading = false;
                    return;
                }
                
                const blob = new Blob([buffer], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                this.cache.set(quality, blob, url);
                console.log(`Preloaded ${quality}: ${Utils.formatFileSize(blob.size)}`);
                
                // Unlock this quality option with file size
                this.ui.unlockQuality(quality, Utils.formatFileSize(blob.size));
                
                // Small delay between compressions to let WASM recover
                await Utils.delay(100);
            } catch (err) {
                this.pendingQualities.delete(quality);  // Remove from pending on error
                console.error(`Failed to preload ${quality}:`, err);
                // Unlock with error indicator
                this.ui.unlockQuality(quality, 'Error - retry');
                // Continue with other qualities even if one fails
                await Utils.delay(200);
            }
        }
        this.isPreloading = false;
        console.log('All qualities preloaded!');
    }

    showInitialUI() {
        Utils.show('loadingSection');
        ['fileInfo', 'compressionOptions', 'resultSection', 'progressSection', 'previewSection', 'compressBtn']
            .forEach(id => Utils.hide(id));
    }

    showReadyUI() {
        Utils.hide('loadingSection');
        Utils.show('fileInfo');
        Utils.show('compressionOptions');
    }

    getCacheKey() {
        return this.quality;
    }

    updatePreviewSize(sizeInBytes) {
        const sizeElement = Utils.$('previewFileSize');
        const diffElement = Utils.$('previewSizeDiff');
        
        if (sizeElement) {
            sizeElement.textContent = Utils.formatFileSize(sizeInBytes);
            console.log('Updated preview size:', Utils.formatFileSize(sizeInBytes));
        } else {
            console.error('previewFileSize element not found');
        }
        
        // Show size difference compared to original
        if (diffElement && this.file) {
            const originalSize = this.file.size;
            const diff = sizeInBytes - originalSize;
            const percent = ((diff / originalSize) * 100).toFixed(1);
            
            if (diff < 0) {
                // Smaller than original (good)
                diffElement.textContent = `(${Math.abs(percent)}% smaller)`;
                diffElement.className = 'text-sm text-green-600 font-medium';
            } else if (diff > 0) {
                // Larger than original
                diffElement.textContent = `(${percent}% larger)`;
                diffElement.className = 'text-sm text-red-500 font-medium';
            } else {
                // Same size
                diffElement.textContent = '(same as original)';
                diffElement.className = 'text-sm text-gray-500';
            }
        }
    }

    async save() {
        const cached = this.cache.get(this.getCacheKey());
        if (!cached) {
            alert('Please wait for preview to load first');
            return;
        }

        Utils.hide('compressBtn');
        Utils.hide('previewSection');
        Utils.show('progressSection');
        Utils.$('progressDetails').innerHTML = '';

        this.ui.updateProgress(50, 'Preparing compressed file...');
        this.compressedBlob = cached.blob;
        this.ui.updateProgress(100, 'Complete!');

        await Utils.delay(500);
        Utils.hide('progressSection');
        this.ui.displayResults(this.file.size, this.compressedBlob.size);
    }

    download() {
        if (!this.compressedBlob) return;

        const name = this.file.name;
        const baseName = name.substring(0, name.lastIndexOf('.'));
        
        const url = URL.createObjectURL(this.compressedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_compressed.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    reset() {
        // Cancel any pending requests
        this.previewRequestId++;
        this.preloadPaused = false;
        this.pendingQualities.clear();  // Clear pending tracking
        this.isPreloading = false;  // Allow new preload to start
        
        this.cache.clear();
        this.renderer.clear();
        
        this.file = null;
        this.compressedBlob = null;
        this.quality = 'original';

        Utils.$('pdfFile').value = '';
        ['loadingSection', 'fileInfo', 'compressionOptions', 'compressBtn', 'progressSection', 'resultSection', 'previewSection']
            .forEach(id => Utils.hide(id));

        // Reset quality selection to default and lock all compression options
        this.ui.lockAllQualities();
        this.ui.resetQualityHints();
        const defaultOpt = document.querySelector('[data-quality="original"]');
        if (defaultOpt) this.ui.setQualityActive(defaultOpt);
    }
}

// Initialize the application
new PDFCompressor();
