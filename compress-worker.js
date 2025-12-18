/**
 * PDF Compression Worker - Ghostscript WASM Engine
 * Clean OOP implementation for background PDF compression
 */

import loadWASM from './gs.js';

class GhostscriptEngine {
    constructor() {
        this.module = null;
        this.inputFile = 'input.pdf';
        this.outputFile = 'output.pdf';
        this.compressionCount = 0;
    }

    async init(forceReinit = false) {
        // Reinitialize every 3 compressions to prevent WASM state corruption
        if (forceReinit || !this.module || this.compressionCount >= 3) {
            console.log('Initializing Ghostscript WASM module...');
            this.module = await loadWASM();
            this.compressionCount = 0;
        }
        return this;
    }

    buildArgs(quality) {
        const args = ['-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.4'];
        
        if (typeof quality === 'number') {
            args.push(
                `-r${quality}`,
                // Only downsample if image resolution is HIGHER than target (never upsample)
                '-dDownsampleColorImages=true',
                '-dDownsampleGrayImages=true',
                '-dDownsampleMonoImages=true',
                '-dColorImageDownsampleType=/Bicubic',
                '-dGrayImageDownsampleType=/Bicubic',
                '-dMonoImageDownsampleType=/Bicubic',
                `-dColorImageResolution=${quality}`,
                `-dGrayImageResolution=${quality}`,
                `-dMonoImageResolution=${quality}`,
                // Threshold: only downsample if image DPI > target DPI * 1.0 (i.e., always downsample higher res)
                `-dColorImageDownsampleThreshold=1.0`,
                `-dGrayImageDownsampleThreshold=1.0`,
                `-dMonoImageDownsampleThreshold=1.0`,
                // Prevent encoding changes that increase size
                '-dAutoFilterColorImages=false',
                '-dAutoFilterGrayImages=false',
                '-dColorImageFilter=/DCTEncode',
                '-dGrayImageFilter=/DCTEncode',
                // Compress streams
                '-dCompressPages=true',
                '-dCompressFonts=true'
            );
        }
        
        args.push(
            '-dPDFSETTINGS=/printer',
            '-dNOPAUSE', '-dQUIET', '-dBATCH',
            `-sOutputFile=${this.outputFile}`,
            this.inputFile
        );
        
        console.log('Ghostscript args for DPI', quality, ':', args);
        return args;
    }

    compress(pdfData, quality) {
        console.log('Compressing with DPI:', quality);
        this.module.FS.writeFile(this.inputFile, new Uint8Array(pdfData));
        
        try {
            this.module.callMain(this.buildArgs(quality));
            const output = this.module.FS.readFile(this.outputFile, { encoding: 'binary' });
            
            // Clean up files
            try { this.module.FS.unlink(this.inputFile); } catch (e) {}
            try { this.module.FS.unlink(this.outputFile); } catch (e) {}
            
            this.compressionCount++;
            return output;
        } catch (err) {
            // Clean up on error
            try { this.module.FS.unlink(this.inputFile); } catch (e) {}
            try { this.module.FS.unlink(this.outputFile); } catch (e) {}
            
            // Force reinit on next compression
            this.compressionCount = 999;
            throw err;
        }
    }
}

class PDFCompressionWorker {
    constructor() {
        this.engine = new GhostscriptEngine();
        this.listen();
    }

    async fetchPDF(blobURL) {
        const response = await fetch(blobURL);
        const buffer = await response.arrayBuffer();
        self.URL.revokeObjectURL(blobURL);
        return buffer;
    }

    parseQuality(quality, customDPI) {
        const qualityMap = {
            'low': 100,
            'medium': 150,
            'good': 200,
            'high': 250,
            'best': 300,
            'original': 'original'
        };
        
        return qualityMap[quality] ?? 150;
    }

    createResult(messageId, output, originalSize) {
        const blob = new Blob([output], { type: 'application/pdf' });
        return {
            messageId,
            status: 'success',
            compressedURL: self.URL.createObjectURL(blob),
            originalSize,
            compressedSize: output.length || output.byteLength
        };
    }

    async process({ messageId, psDataURL, quality, customDPI }) {
        try {
            const buffer = await this.fetchPDF(psDataURL);
            const originalData = new Uint8Array(buffer);
            const parsedQuality = this.parseQuality(quality, customDPI);
            
            console.log(`Processing messageId=${messageId}, quality=${quality}, DPI=${parsedQuality}`);
            
            // Skip compression for "original" - return file as-is
            if (parsedQuality === 'original') {
                self.postMessage(this.createResult(messageId, originalData, buffer.byteLength));
                return;
            }
            
            await this.engine.init();
            const output = this.engine.compress(buffer, parsedQuality);
            
            // If compressed is LARGER than original, use original instead
            const compressedSize = output.length || output.byteLength;
            if (compressedSize >= buffer.byteLength) {
                console.log(`Compressed (${compressedSize}) >= Original (${buffer.byteLength}), using original`);
                self.postMessage(this.createResult(messageId, originalData, buffer.byteLength));
                return;
            }
            
            self.postMessage(this.createResult(messageId, output, buffer.byteLength));
        } catch (err) {
            self.postMessage({ messageId, status: 'error', error: `Compression failed: ${err.message}` });
        }
    }

    listen() {
        self.addEventListener('message', (e) => this.process(e.data));
    }
}

new PDFCompressionWorker();
