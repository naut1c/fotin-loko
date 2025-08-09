class ImageToTextArt {
    constructor() {
        this.canvas = document.getElementById('imageCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.originalImage = null;
        this.processedImageData = null;
        this.selection = null;
        this.gridVisible = false;
        this.isSelecting = false;
        this.startPos = null;
        this.aspectLocked = false;
        this.originalAspectRatio = 1;
        this.zoomLevel = 1;
        this.previewZoom = 1;
        this.currentFileIndex = 0;
        this.uploadedFiles = [];
        
        // Image adjustment values
        this.brightness = 0;
        this.contrast = 0;
        this.saturation = 0;
        this.threshold = 0;
        this.samplingMethod = 'average';
        this.outputFormat = 'html';
        
        // Character sets
        this.characterSets = {
            block: '█',
            gradient: '░▒▓█',
            ascii: '.:;+=xX$&#@',
            braille: '⠀⠁⠃⠇⠏⠟⠿⡿',
            custom: '█'
        };
        
        this.currentCharacterSet = 'block';
        
        this.initializeEventListeners();
        this.updateUI();
    }

    initializeEventListeners() {
        // File upload
        const imageInput = document.getElementById('imageInput');
        imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        
        // Drag and drop
        const fileInputDisplay = document.querySelector('.file-input-display');
        if (fileInputDisplay) {
            fileInputDisplay.addEventListener('dragover', (e) => this.handleDragOver(e));
            fileInputDisplay.addEventListener('drop', (e) => this.handleDrop(e));
        }
        
        // Controls
        document.getElementById('showGridBtn')?.addEventListener('click', () => this.toggleGrid());
        document.getElementById('resetBtn')?.addEventListener('click', () => this.resetImage());
        document.getElementById('generateBtn')?.addEventListener('click', () => this.generateFullTextArt());
        document.getElementById('copyBtn')?.addEventListener('click', () => this.copyToClipboard());
        document.getElementById('downloadBtn')?.addEventListener('click', () => this.downloadTextArt());
        
        // Aspect ratio lock
        document.getElementById('aspectLockBtn')?.addEventListener('click', () => this.toggleAspectLock());
        
        // Zoom controls
        document.getElementById('zoomInBtn')?.addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutBtn')?.addEventListener('click', () => this.zoomOut());
        document.getElementById('fitBtn')?.addEventListener('click', () => this.fitToView());
        
        // Preview zoom
        document.getElementById('previewZoomIn')?.addEventListener('click', () => this.changePreviewZoom(1.2));
        document.getElementById('previewZoomOut')?.addEventListener('click', () => this.changePreviewZoom(0.8));
        
        // Image adjustment sliders
        document.getElementById('brightnessSlider')?.addEventListener('input', (e) => this.updateBrightness(e));
        document.getElementById('contrastSlider')?.addEventListener('input', (e) => this.updateContrast(e));
        document.getElementById('saturationSlider')?.addEventListener('input', (e) => this.updateSaturation(e));
        document.getElementById('thresholdSlider')?.addEventListener('input', (e) => this.updateThreshold(e));
        
        // Sampling method and output format
        document.getElementById('samplingMethod')?.addEventListener('change', (e) => this.updateSamplingMethod(e));
        document.getElementById('outputFormat')?.addEventListener('change', (e) => this.updateOutputFormat(e));
        
        // Character set
        document.getElementById('characterSet')?.addEventListener('change', (e) => this.updateCharacterSet(e));
        document.getElementById('customChars')?.addEventListener('input', (e) => this.updateCustomChars(e));
        
        // Canvas interaction
        this.canvas.addEventListener('mousedown', (e) => this.startSelection(e));
        this.canvas.addEventListener('mousemove', (e) => this.updateSelection(e));
        this.canvas.addEventListener('mouseup', (e) => this.endSelection(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        
        // Dimension changes
        document.getElementById('widthInput')?.addEventListener('input', () => this.onDimensionChange());
        document.getElementById('heightInput')?.addEventListener('input', () => this.onDimensionChange());
        
        // Live preview and auto enhance
        document.getElementById('livePreview')?.addEventListener('change', () => this.updatePreview());
        document.getElementById('autoEnhance')?.addEventListener('change', () => this.toggleAutoEnhance());
        
        // Preset modal
        document.getElementById('presetBtn')?.addEventListener('click', () => this.showPresetModal());
        document.getElementById('closePresetModal')?.addEventListener('click', () => this.hidePresetModal());
        
        // Preset items
        document.querySelectorAll('.preset-item').forEach(item => {
            item.addEventListener('click', () => this.applyPreset(item.dataset.preset));
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'));
        if (files.length > 0) {
            this.handleMultipleFiles(files);
        }
    }

    handleImageUpload(event) {
        const files = Array.from(event.target.files);
        this.handleMultipleFiles(files);
    }

    handleMultipleFiles(files) {
        this.uploadedFiles = files;
        this.currentFileIndex = 0;
        this.updateFileList();
        
        if (files.length > 0) {
            this.loadImageFile(files[0], 0);
        }
        
        // Enable batch processing if multiple files
        const batchBtn = document.getElementById('batchBtn');
        if (batchBtn) {
            batchBtn.disabled = files.length <= 1;
        }
    }

    updateFileList() {
        const fileList = document.getElementById('fileList');
        if (!fileList) return;
        
        if (this.uploadedFiles.length <= 1) {
            fileList.style.display = 'none';
            return;
        }
        
        fileList.style.display = 'block';
        fileList.innerHTML = this.uploadedFiles.map((file, index) => 
            `<div class="file-item ${index === this.currentFileIndex ? 'active' : ''}" data-index="${index}">
                <span class="file-name">${file.name}</span>
                <span class="file-size">${this.formatFileSize(file.size)}</span>
            </div>`
        ).join('');
        
        // Add click handlers
        fileList.querySelectorAll('.file-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.loadImageFile(this.uploadedFiles[index], index);
            });
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    loadImageFile(file, index) {
        this.currentFileIndex = index;
        this.updateFileList();
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Ensure image is fully loaded before proceeding
                if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
                    this.originalImage = img;
                    this.originalAspectRatio = img.width / img.height;
                    this.setupCanvas();
                    this.processImage();
                    this.resetSelection();
                    this.updateUI();
                    this.updatePreview();
                    this.showToast(`Loaded: ${file.name}`, 'success');
                } else {
                    this.showToast('Failed to load image properly', 'error');
                }
            };
            img.onerror = () => {
                this.showToast('Failed to load image', 'error');
            };
            img.src = e.target.result;
        };
        reader.onerror = () => {
            this.showToast('Failed to read file', 'error');
        };
        reader.readAsDataURL(file);
    }

    setupCanvas() {
        if (!this.originalImage || !this.originalImage.complete) {
            console.warn('Image not ready for canvas setup');
            return;
        }
        
        const container = document.getElementById('canvasContainer');
        const maxWidth = container ? container.clientWidth - 40 : 800;
        const maxHeight = 500;
        
        let { width, height } = this.originalImage;
        
        // Scale image to fit canvas while maintaining aspect ratio
        const scale = Math.min(maxWidth / width, maxHeight / height, 1);
        
        this.canvas.width = width * scale;
        this.canvas.height = height * scale;
        
        this.fitToView();
    }

    processImage() {
        if (!this.originalImage || !this.originalImage.complete || this.originalImage.naturalWidth === 0) {
            console.warn('Cannot process image - image not ready');
            return;
        }
        
        try {
            // Create temporary canvas for image processing
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCanvas.width = this.canvas.width;
            tempCanvas.height = this.canvas.height;
            
            // Clear canvas first
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Draw original image with error handling
            tempCtx.drawImage(this.originalImage, 0, 0, this.canvas.width, this.canvas.height);
            
            // Get image data for processing
            const imageData = tempCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const data = imageData.data;
            
            // Apply image adjustments
            for (let i = 0; i < data.length; i += 4) {
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];
                
                // Apply brightness
                r = Math.max(0, Math.min(255, r + this.brightness));
                g = Math.max(0, Math.min(255, g + this.brightness));
                b = Math.max(0, Math.min(255, b + this.brightness));
                
                // Apply contrast
                const contrastFactor = (259 * (this.contrast + 255)) / (255 * (259 - this.contrast));
                r = Math.max(0, Math.min(255, contrastFactor * (r - 128) + 128));
                g = Math.max(0, Math.min(255, contrastFactor * (g - 128) + 128));
                b = Math.max(0, Math.min(255, contrastFactor * (b - 128) + 128));
                
                // Apply saturation
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                const satFactor = (this.saturation + 100) / 100;
                r = Math.max(0, Math.min(255, gray + satFactor * (r - gray)));
                g = Math.max(0, Math.min(255, gray + satFactor * (g - gray)));
                b = Math.max(0, Math.min(255, gray + satFactor * (b - gray)));
                
                // Apply threshold
                if (this.threshold > 0) {
                    const grayVal = (r + g + b) / 3;
                    if (grayVal < this.threshold) {
                        r = g = b = 0;
                    } else {
                        r = g = b = 255;
                    }
                }
                
                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
            }
            
            // Auto enhance if enabled
            const autoEnhanceEl = document.getElementById('autoEnhance');
            if (autoEnhanceEl && autoEnhanceEl.checked) {
                this.applyAutoEnhance(data);
            }
            
            this.processedImageData = imageData;
            this.drawImage();
        } catch (error) {
            console.error('Error processing image:', error);
            this.showToast('Error processing image', 'error');
        }
    }

    applyAutoEnhance(data) {
        // Simple auto-enhancement: histogram equalization
        const histogram = new Array(256).fill(0);
        const pixelCount = data.length / 4;
        
        // Build histogram
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            histogram[gray]++;
        }
        
        // Build cumulative distribution
        const cdf = new Array(256);
        cdf[0] = histogram[0];
        for (let i = 1; i < 256; i++) {
            cdf[i] = cdf[i - 1] + histogram[i];
        }
        
        // Apply equalization
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            const newGray = Math.round((cdf[gray] / pixelCount) * 255);
            const factor = newGray / (gray || 1);
            
            data[i] = Math.max(0, Math.min(255, data[i] * factor));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * factor));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * factor));
        }
    }

    drawImage() {
        if (!this.canvas || !this.ctx) return;
        
        try {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            if (this.processedImageData) {
                this.ctx.putImageData(this.processedImageData, 0, 0);
            }
            
            if (this.gridVisible) {
                this.drawGrid();
            }
            
            if (this.selection) {
                this.drawSelection();
            }
        } catch (error) {
            console.error('Error drawing image:', error);
        }
    }

    // Image adjustment methods
    updateBrightness(event) {
        this.brightness = parseInt(event.target.value);
        const valueEl = document.getElementById('brightnessValue');
        if (valueEl) valueEl.textContent = this.brightness;
        this.processImage();
        this.updatePreview();
    }

    updateContrast(event) {
        this.contrast = parseInt(event.target.value);
        const valueEl = document.getElementById('contrastValue');
        if (valueEl) valueEl.textContent = this.contrast;
        this.processImage();
        this.updatePreview();
    }

    updateSaturation(event) {
        this.saturation = parseInt(event.target.value);
        const valueEl = document.getElementById('saturationValue');
        if (valueEl) valueEl.textContent = this.saturation;
        this.processImage();
        this.updatePreview();
    }

    updateThreshold(event) {
        this.threshold = parseInt(event.target.value);
        const valueEl = document.getElementById('thresholdValue');
        if (valueEl) valueEl.textContent = this.threshold === 0 ? 'Off' : this.threshold;
        this.processImage();
        this.updatePreview();
    }

    updateSamplingMethod(event) {
        this.samplingMethod = event.target.value;
        this.updatePreview();
    }

    updateOutputFormat(event) {
        this.outputFormat = event.target.value;
    }

    updateCharacterSet(event) {
        this.currentCharacterSet = event.target.value;
        const customInput = document.getElementById('customChars');
        if (customInput) {
            customInput.style.display = event.target.value === 'custom' ? 'block' : 'none';
        }
        this.updatePreview();
    }

    updateCustomChars(event) {
        this.characterSets.custom = event.target.value || '█';
        this.updatePreview();
    }

    resetImage() {
        this.brightness = 0;
        this.contrast = 0;
        this.saturation = 0;
        this.threshold = 0;
        
        const elements = [
            { id: 'brightnessSlider', value: 0 },
            { id: 'contrastSlider', value: 0 },
            { id: 'saturationSlider', value: 0 },
            { id: 'thresholdSlider', value: 0 },
            { id: 'brightnessValue', text: '0' },
            { id: 'contrastValue', text: '0' },
            { id: 'saturationValue', text: '0' },
            { id: 'thresholdValue', text: 'Off' }
        ];
        
        elements.forEach(el => {
            const element = document.getElementById(el.id);
            if (element) {
                if (el.value !== undefined) element.value = el.value;
                if (el.text !== undefined) element.textContent = el.text;
            }
        });
        
        this.processImage();
        this.updatePreview();
    }

    // Dimension and aspect ratio handling
    toggleAspectLock() {
        this.aspectLocked = !this.aspectLocked;
        const btn = document.getElementById('aspectLockBtn');
        if (btn) {
            btn.textContent = this.aspectLocked ? '🔒' : '🔓';
            btn.title = this.aspectLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio';
        }
    }

    onDimensionChange() {
        if (this.aspectLocked) {
            const widthInput = document.getElementById('widthInput');
            const heightInput = document.getElementById('heightInput');
            
            if (!widthInput || !heightInput) return;
            
            if (document.activeElement === widthInput) {
                const newWidth = parseInt(widthInput.value) || 50;
                const newHeight = Math.round(newWidth / this.originalAspectRatio);
                heightInput.value = newHeight;
            } else if (document.activeElement === heightInput) {
                const newHeight = parseInt(heightInput.value) || 30;
                const newWidth = Math.round(newHeight * this.originalAspectRatio);
                widthInput.value = newWidth;
            }
        }
        
        this.updateGrid();
        this.updateSelectionInfo();
        this.updatePreview();
    }

    // Zoom functionality
    zoomIn() {
        this.zoomLevel = Math.min(this.zoomLevel * 1.25, 5);
        this.applyZoom();
    }

    zoomOut() {
        this.zoomLevel = Math.max(this.zoomLevel * 0.8, 0.1);
        this.applyZoom();
    }

    fitToView() {
        this.zoomLevel = 1;
        this.applyZoom();
    }

    applyZoom() {
        this.canvas.style.transform = `scale(${this.zoomLevel})`;
        this.canvas.style.transformOrigin = 'top left';
        const zoomEl = document.getElementById('zoomLevel');
        if (zoomEl) zoomEl.textContent = Math.round(this.zoomLevel * 100) + '%';
    }

    handleWheel(e) {
        if (e.ctrlKey) {
            e.preventDefault();
            if (e.deltaY < 0) {
                this.zoomIn();
            } else {
                this.zoomOut();
            }
        }
    }

    changePreviewZoom(factor) {
        this.previewZoom = Math.max(0.5, Math.min(3, this.previewZoom * factor));
        const previewArea = document.getElementById('previewArea');
        if (previewArea) {
            previewArea.style.fontSize = `${8 * this.previewZoom}px`;
            previewArea.style.lineHeight = `${0.8 * this.previewZoom}`;
        }
    }

    // Grid functionality
    toggleGrid() {
        this.gridVisible = !this.gridVisible;
        const btn = document.getElementById('showGridBtn');
        if (btn) btn.textContent = this.gridVisible ? 'Hide Grid' : 'Show Grid';
        this.drawImage();
    }

    drawGrid() {
        const widthInput = document.getElementById('widthInput');
        const heightInput = document.getElementById('heightInput');
        
        const width = widthInput ? parseInt(widthInput.value) || 50 : 50;
        const height = heightInput ? parseInt(heightInput.value) || 30 : 30;
        
        let gridArea = {
            x: 0,
            y: 0,
            width: this.canvas.width,
            height: this.canvas.height
        };
        
        if (this.selection && this.selection.width > 0 && this.selection.height > 0) {
            gridArea = this.selection;
        }
        
        const cellWidth = gridArea.width / width;
        const cellHeight = gridArea.height / height;
        
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([2, 2]);
        
        // Draw vertical lines
        for (let i = 0; i <= width; i++) {
            const x = gridArea.x + (i * cellWidth);
            this.ctx.beginPath();
            this.ctx.moveTo(x, gridArea.y);
            this.ctx.lineTo(x, gridArea.y + gridArea.height);
            this.ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let i = 0; i <= height; i++) {
            const y = gridArea.y + (i * cellHeight);
            this.ctx.beginPath();
            this.ctx.moveTo(gridArea.x, y);
            this.ctx.lineTo(gridArea.x + gridArea.width, y);
            this.ctx.stroke();
        }
        
        this.ctx.setLineDash([]);
    }

    updateGrid() {
        if (this.gridVisible && this.originalImage) {
            this.drawImage();
        }
    }

    // Selection functionality
    startSelection(event) {
        if (!this.originalImage) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (event.clientX - rect.left) / this.zoomLevel;
        const y = (event.clientY - rect.top) / this.zoomLevel;
        
        this.isSelecting = true;
        this.startPos = { x, y };
        this.selection = { x, y, width: 0, height: 0 };
    }

    updateSelection(event) {
        if (!this.isSelecting || !this.startPos) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const currentX = (event.clientX - rect.left) / this.zoomLevel;
        const currentY = (event.clientY - rect.top) / this.zoomLevel;
        
        this.selection = {
            x: Math.max(0, Math.min(this.startPos.x, currentX)),
            y: Math.max(0, Math.min(this.startPos.y, currentY)),
            width: Math.min(this.canvas.width, Math.abs(currentX - this.startPos.x)),
            height: Math.min(this.canvas.height, Math.abs(currentY - this.startPos.y))
        };
        
        // Constrain selection to canvas bounds
        if (this.selection.x + this.selection.width > this.canvas.width) {
            this.selection.width = this.canvas.width - this.selection.x;
        }
        if (this.selection.y + this.selection.height > this.canvas.height) {
            this.selection.height = this.canvas.height - this.selection.y;
        }
        
        this.drawImage();
        this.updateSelectionInfo();
        this.updatePreview();
    }

    endSelection(event) {
        this.isSelecting = false;
        this.startPos = null;
        
        if (this.selection && (this.selection.width < 5 || this.selection.height < 5)) {
            this.resetSelection();
        }
        
        this.updateSelectionInfo();
    }

    drawSelection() {
        if (!this.selection) return;
        
        this.ctx.strokeStyle = '#4facfe';
        this.ctx.lineWidth = 2;
        this.ctx.fillStyle = 'rgba(79, 172, 254, 0.1)';
        
        this.ctx.fillRect(this.selection.x, this.selection.y, this.selection.width, this.selection.height);
        this.ctx.strokeRect(this.selection.x, this.selection.y, this.selection.width, this.selection.height);
        
        // Draw selection info overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(this.selection.x, this.selection.y - 25, 150, 25);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`${Math.round(this.selection.width)}×${Math.round(this.selection.height)}`, 
                         this.selection.x + 5, this.selection.y - 8);
    }

    resetSelection() {
        this.selection = null;
        this.updateSelectionInfo();
        this.drawImage();
        this.updatePreview();
    }

    updateSelectionInfo() {
        const info = document.getElementById('selectionInfo');
        if (!info) return;
        
        if (!this.originalImage) {
            info.textContent = 'No image loaded. Upload an image to begin.';
            return;
        }
        
        const widthInput = document.getElementById('widthInput');
        const heightInput = document.getElementById('heightInput');
        const width = widthInput ? parseInt(widthInput.value) || 50 : 50;
        const height = heightInput ? parseInt(heightInput.value) || 30 : 30;
        
        if (this.selection && this.selection.width > 0 && this.selection.height > 0) {
            const scaleX = this.originalImage.width / this.canvas.width;
            const scaleY = this.originalImage.height / this.canvas.height;
            
            const realWidth = Math.round(this.selection.width * scaleX);
            const realHeight = Math.round(this.selection.height * scaleY);
            
            info.innerHTML = `<strong>Selected:</strong> ${realWidth} × ${realHeight} px<br>
                             <strong>Grid:</strong> ${width} × ${height} chars 
                             (${Math.round(realWidth/width)}×${Math.round(realHeight/height)} px/char)`;
        } else {
            info.innerHTML = `<strong>Full image:</strong> ${this.originalImage.width} × ${this.originalImage.height} px<br>
                             <strong>Grid:</strong> ${width} × ${height} chars 
                             (${Math.round(this.originalImage.width/width)}×${Math.round(this.originalImage.height/height)} px/char)
                             <br><em>Click and drag to select region</em>`;
        }
    }

    // Preview functionality
    updatePreview() {
        const previewCheckbox = document.getElementById('livePreview');
        const previewArea = document.getElementById('previewArea');
        
        if (!previewArea) return;
        
        if (!previewCheckbox || !previewCheckbox.checked || !this.originalImage) {
            previewArea.textContent = 'Live preview disabled or no image loaded.';
            return;
        }

        const widthInput = document.getElementById('widthInput');
        const heightInput = document.getElementById('heightInput');
        const width = Math.min(40, widthInput ? parseInt(widthInput.value) || 50 : 50);
        const height = Math.min(25, heightInput ? parseInt(heightInput.value) || 30 : 30);
        
        const textArt = this.generateTextArtData(width, height, true);
        previewArea.innerHTML = textArt;
    }

    // Text art generation
    generateTextArtData(width, height, isPreview = false) {
        if (!this.processedImageData) return '';
        
        // Determine source area
        let sourceX = 0, sourceY = 0, sourceWidth = this.canvas.width, sourceHeight = this.canvas.height;
        
        if (this.selection && this.selection.width > 0 && this.selection.height > 0) {
            sourceX = this.selection.x;
            sourceY = this.selection.y;
            sourceWidth = this.selection.width;
            sourceHeight = this.selection.height;
        }
        
        const cellWidth = sourceWidth / width;
        const cellHeight = sourceHeight / height;
        
        let textArt = '';
        const data = this.processedImageData.data;
        const canvasWidth = this.canvas.width;
        const chars = this.characterSets[this.currentCharacterSet];
        
        // Show progress for large generations
        if (!isPreview && (width * height > 1000)) {
            this.showProgress(true);
        }
        
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const startX = Math.floor(sourceX + col * cellWidth);
                const endX = Math.floor(sourceX + (col + 1) * cellWidth);
                const startY = Math.floor(sourceY + row * cellHeight);
                const endY = Math.floor(sourceY + (row + 1) * cellHeight);
                
                let color = this.getPixelColor(startX, startY, endX, endY, data, canvasWidth);
                const char = this.getCharacterForBrightness(color, chars);
                
                if (this.outputFormat === 'html' || isPreview) {
                    const hex = this.rgbToHex(color.r, color.g, color.b);
                    textArt += `<span style="color: ${hex}">${char}</span>`;
                } else {
                    // For the specific format requested: [color=HEX_COLOR]█[/color]
                    const hex = this.rgbToHex(color.r, color.g, color.b);
                    textArt += `[color=${hex}]${char}[/color]`;
                }
            }
            if (row < height - 1) textArt += isPreview || this.outputFormat === 'html' ? '<br>' : '\n';
        }
        
        if (!isPreview && (width * height > 1000)) {
            this.showProgress(false);
        }
        
        return textArt;
    }

    getPixelColor(startX, startY, endX, endY, data, canvasWidth) {
        switch (this.samplingMethod) {
            case 'center':
                return this.getCenterPixelColor(startX, startY, endX, endY, data, canvasWidth);
            case 'dominant':
                return this.getDominantColor(startX, startY, endX, endY, data, canvasWidth);
            case 'median':
                return this.getMedianColor(startX, startY, endX, endY, data, canvasWidth);
            case 'weighted':
                return this.getWeightedAverageColor(startX, startY, endX, endY, data, canvasWidth);
            default:
                return this.getAverageColor(startX, startY, endX, endY, data, canvasWidth);
        }
    }

    // Complete the getCenterPixelColor method and add all missing methods
    getCenterPixelColor(startX, startY, endX, endY, data, canvasWidth) {
        const centerX = Math.floor((startX + endX) / 2);
        const centerY = Math.floor((startY + endY) / 2);
        const index = (centerY * canvasWidth + centerX) * 4;
        
        return {
            r: data[index] || 0,
            g: data[index + 1] || 0,
            b: data[index + 2] || 0
        };
    }

    getAverageColor(startX, startY, endX, endY, data, canvasWidth) {
        let totalR = 0, totalG = 0, totalB = 0, pixelCount = 0;
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const index = (y * canvasWidth + x) * 4;
                if (index < data.length) {
                    totalR += data[index];
                    totalG += data[index + 1];
                    totalB += data[index + 2];
                    pixelCount++;
                }
            }
        }
        
        return pixelCount > 0 ? {
            r: Math.round(totalR / pixelCount),
            g: Math.round(totalG / pixelCount),
            b: Math.round(totalB / pixelCount)
        } : { r: 0, g: 0, b: 0 };
    }

    getDominantColor(startX, startY, endX, endY, data, canvasWidth) {
        const colorMap = new Map();
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const index = (y * canvasWidth + x) * 4;
                if (index < data.length) {
                    const r = Math.floor(data[index] / 16) * 16;
                    const g = Math.floor(data[index + 1] / 16) * 16;
                    const b = Math.floor(data[index + 2] / 16) * 16;
                    const colorKey = `${r},${g},${b}`;
                    
                    colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
                }
            }
        }
        
        let dominantColor = { r: 0, g: 0, b: 0 };
        let maxCount = 0;
        
        for (const [colorKey, count] of colorMap) {
            if (count > maxCount) {
                maxCount = count;
                const [r, g, b] = colorKey.split(',').map(Number);
                dominantColor = { r, g, b };
            }
        }
        
        return dominantColor;
    }

    getMedianColor(startX, startY, endX, endY, data, canvasWidth) {
        const rValues = [], gValues = [], bValues = [];
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const index = (y * canvasWidth + x) * 4;
                if (index < data.length) {
                    rValues.push(data[index]);
                    gValues.push(data[index + 1]);
                    bValues.push(data[index + 2]);
                }
            }
        }
        
        const getMedian = (arr) => {
            arr.sort((a, b) => a - b);
            const mid = Math.floor(arr.length / 2);
            return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
        };
        
        return {
            r: Math.round(getMedian(rValues)),
            g: Math.round(getMedian(gValues)),
            b: Math.round(getMedian(bValues))
        };
    }

    getWeightedAverageColor(startX, startY, endX, endY, data, canvasWidth) {
        let totalR = 0, totalG = 0, totalB = 0, totalWeight = 0;
        const centerX = (startX + endX) / 2;
        const centerY = (startY + endY) / 2;
        const maxDistance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const index = (y * canvasWidth + x) * 4;
                if (index < data.length) {
                    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                    const weight = 1 - (distance / maxDistance);
                    
                    totalR += data[index] * weight;
                    totalG += data[index + 1] * weight;
                    totalB += data[index + 2] * weight;
                    totalWeight += weight;
                }
            }
        }
        
        return totalWeight > 0 ? {
            r: Math.round(totalR / totalWeight),
            g: Math.round(totalG / totalWeight),
            b: Math.round(totalB / totalWeight)
        } : { r: 0, g: 0, b: 0 };
    }

    getCharacterForBrightness(color, chars) {
        if (chars.length === 1) return chars;
        
        const brightness = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
        const index = Math.floor((brightness / 255) * (chars.length - 1));
        return chars[Math.max(0, Math.min(chars.length - 1, index))];
    }

    rgbToHex(r, g, b) {
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    // Generate full text art
    generateFullTextArt() {
        if (!this.originalImage) {
            this.showToast('Please upload an image first', 'error');
            return;
        }
        
        const width = parseInt(document.getElementById('widthInput').value) || 50;
        const height = parseInt(document.getElementById('heightInput').value) || 30;
        
        // Always use the specific format: [color=HEX_COLOR]█[/color]
        const textArt = this.generateTextArtInSpecificFormat(width, height);
        
        const outputArea = document.getElementById('outputArea');
        outputArea.textContent = textArt;
        
        // Enable output buttons
        document.getElementById('copyBtn').disabled = false;
        document.getElementById('downloadBtn').disabled = false;
        document.getElementById('shareBtn').disabled = false;
        
        this.showToast('Text art generated successfully!', 'success');
    }

    generateTextArtInSpecificFormat(width, height) {
        if (!this.processedImageData) return '';
        
        // Determine source area
        let sourceX = 0, sourceY = 0, sourceWidth = this.canvas.width, sourceHeight = this.canvas.height;
        
        if (this.selection && this.selection.width > 0 && this.selection.height > 0) {
            sourceX = this.selection.x;
            sourceY = this.selection.y;
            sourceWidth = this.selection.width;
            sourceHeight = this.selection.height;
        }
        
        const cellWidth = sourceWidth / width;
        const cellHeight = sourceHeight / height;
        
        let textArt = '';
        const data = this.processedImageData.data;
        const canvasWidth = this.canvas.width;
        const chars = this.characterSets[this.currentCharacterSet]; // Get selected character set
        
        // Show progress for large generations
        if (width * height > 1000) {
            this.showProgress(true);
        }
        
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const startX = Math.floor(sourceX + col * cellWidth);
                const endX = Math.floor(sourceX + (col + 1) * cellWidth);
                const startY = Math.floor(sourceY + row * cellHeight);
                const endY = Math.floor(sourceY + (row + 1) * cellHeight);
                
                let color = this.getPixelColor(startX, startY, endX, endY, data, canvasWidth);
                const char = this.getCharacterForBrightness(color, chars); // Use brightness-based character selection
                const hex = this.rgbToHex(color.r, color.g, color.b);
                
                // Use the selected character instead of hardcoded █
                textArt += `[color=${hex}]${char}[/color]`;
            }
            if (row < height - 1) textArt += '\n';
        }
        
        if (width * height > 1000) {
            this.showProgress(false);
        }
        
        return textArt;
    }

    // Copy to clipboard
    copyToClipboard() {
        const outputArea = document.getElementById('outputArea');
        if (!outputArea.textContent.trim()) {
            this.showToast('No text art to copy', 'error');
            return;
        }
        
        navigator.clipboard.writeText(outputArea.textContent).then(() => {
            this.showToast('Text art copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = outputArea.textContent;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showToast('Text art copied to clipboard!', 'success');
        });
    }

    // Download text art
    downloadTextArt() {
        const outputArea = document.getElementById('outputArea');
        if (!outputArea.textContent.trim()) {
            this.showToast('No text art to download', 'error');
            return;
        }
        
        const filename = `textart_${Date.now()}.txt`;
        const blob = new Blob([outputArea.textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast(`Downloaded as ${filename}`, 'success');
    }

    // Progress indicator
    showProgress(show, text = 'Processing...') {
        const progressBar = document.getElementById('progressBar');
        const progressText = progressBar.querySelector('.progress-text');
        
        if (show) {
            progressBar.style.display = 'block';
            progressText.textContent = text;
        } else {
            progressBar.style.display = 'none';
        }
    }

    // Preset functionality
    showPresetModal() {
        document.getElementById('presetModal').style.display = 'flex';
    }

    hidePresetModal() {
        document.getElementById('presetModal').style.display = 'none';
    }

    applyPreset(preset) {
        const presets = {
            photo: {
                brightness: 0,
                contrast: 10,
                saturation: 5,
                threshold: 0,
                samplingMethod: 'average',
                characterSet: 'block'
            },
            artwork: {
                brightness: 5,
                contrast: 20,
                saturation: 15,
                threshold: 0,
                samplingMethod: 'dominant',
                characterSet: 'gradient'
            },
            terminal: {
                brightness: 0,
                contrast: 30,
                saturation: -20,
                threshold: 0,
                samplingMethod: 'center',
                characterSet: 'ascii'
            },
            retro: {
                brightness: -5,
                contrast: 25,
                saturation: -10,
                threshold: 50,
                samplingMethod: 'dominant',
                characterSet: 'block'
            }
        };
        
        const config = presets[preset];
        if (!config) return;
        
        // Apply settings
        this.brightness = config.brightness;
        this.contrast = config.contrast;
        this.saturation = config.saturation;
        this.threshold = config.threshold;
        this.samplingMethod = config.samplingMethod;
        this.currentCharacterSet = config.characterSet;
        
        // Update UI
        document.getElementById('brightnessSlider').value = config.brightness;
        document.getElementById('contrastSlider').value = config.contrast;
        document.getElementById('saturationSlider').value = config.saturation;
        document.getElementById('thresholdSlider').value = config.threshold;
        document.getElementById('brightnessValue').textContent = config.brightness;
        document.getElementById('contrastValue').textContent = config.contrast;
        document.getElementById('saturationValue').textContent = config.saturation;
        document.getElementById('thresholdValue').textContent = config.threshold === 0 ? 'Off' : config.threshold;
        document.getElementById('samplingMethod').value = config.samplingMethod;
        document.getElementById('characterSet').value = config.characterSet;
        
        this.processImage();
        this.updatePreview();
        this.hidePresetModal();
        this.showToast(`Applied ${preset} preset`, 'success');
    }

    // Toast notifications
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Remove after delay
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => container.removeChild(toast), 300);
        }, 3000);
    }

    // Auto enhance toggle
    toggleAutoEnhance() {
        this.processImage();
        this.updatePreview();
    }

    // Update UI state
    updateUI() {
        const hasImage = !!this.originalImage;
        
        document.getElementById('showGridBtn').disabled = !hasImage;
        document.getElementById('resetBtn').disabled = !hasImage;
        document.getElementById('generateBtn').disabled = !hasImage;
        document.getElementById('presetBtn').disabled = !hasImage;
        
        if (hasImage) {
            document.getElementById('canvasStatus').textContent = 'Image loaded successfully';
            document.getElementById('imageInfo').textContent = 
                `${this.originalImage.width} × ${this.originalImage.height} pixels`;
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new ImageToTextArt();
});