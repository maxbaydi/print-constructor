class SimplexNoise {
    constructor(seed = Math.random() * 1000000) {
        this.grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
        this.p = [];
        for (let i = 0; i < 256; i++) this.p[i] = Math.floor(seed * (i + 1)) % 256;
        this.perm = [];
        for (let i = 0; i < 512; i++) this.perm[i] = this.p[i & 255] % 12;
    }

    dot(g, x, y) { return g[0] * x + g[1] * y; }

    noise(xin, yin) {
        const F2 = 0.5 * (Math.sqrt(3) - 1);
        const s = (xin + yin) * F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);
        const G2 = (3 - Math.sqrt(3)) / 6;
        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = xin - X0;
        const y0 = yin - Y0;
        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2;
        const y2 = y0 - 1 + 2 * G2;
        const ii = i & 255;
        const jj = j & 255;
        const gi0 = this.perm[ii + this.perm[jj]] % 12;
        const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] % 12;
        const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] % 12;
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        let n0 = 0;
        if (t0 >= 0) {
            t0 *= t0;
            n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0);
        }
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        let n1 = 0;
        if (t1 >= 0) {
            t1 *= t1;
            n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1);
        }
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        let n2 = 0;
        if (t2 >= 0) {
            t2 *= t2;
            n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2);
        }
        return 70.0 * (n0 + n1 + n2);
    }

    octaveNoise(x, y, octaves = 4, persistence = 0.5, scale = 1.0) {
        let value = 0;
        let amplitude = 1;
        let frequency = scale;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += this.noise(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }

        return value / maxValue;
    }
}

class StampGenerator {
    constructor() {
        this.canvas = document.getElementById('stampCanvas');
        if (!this.canvas) {
            console.error('Canvas элемент не найден!');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('Не удалось получить контекст canvas!');
            return;
        }

        this.distortionMap = document.querySelector('#stamp-distort feDisplacementMap');
        this.turbulence = document.querySelector('#stamp-distort feTurbulence');
        this.distressedTurbulence = document.querySelector('#distressed-stamp feTurbulence');
        this.distressedDisplacement = document.querySelector('#distressed-stamp feDisplacementMap');
        this.distressedSaturate = document.querySelector('#distressed-stamp feColorMatrix');

        this.simplex = new SimplexNoise(12345);
        this.simplexPaper = new SimplexNoise(67890);
        this.simplexWear = new SimplexNoise(11111);
        this.simplexAging = new SimplexNoise(22222);

        this.textures = {
            noiseMap: null,
            variationMap: null,
            paperTexture: null,
            wearMap: null,
            grungeMask: null,
            agingTexture: null
        };

        this.backgroundImage = null;
        this.loadBackgroundImage();

        this.inputs = {
            topText: document.getElementById('topText'),
            bottomText: document.getElementById('bottomText'),
            topFont: document.getElementById('topFontFamily'),
            bottomFont: document.getElementById('bottomFontFamily'),
            topSize: document.getElementById('topFontSize'),
            bottomSize: document.getElementById('bottomFontSize'),
            topSpacing: document.getElementById('topLetterSpacing'),
            bottomSpacing: document.getElementById('bottomLetterSpacing'),
            topRadius: document.getElementById('topTextRadius'),
            bottomRadius: document.getElementById('bottomTextRadius'),
            starSize: document.getElementById('starSize'),
            circleWidth: document.getElementById('circleWidth'),
            stampSize: document.getElementById('stampSize'),
            resolution: document.getElementById('exportResolution'),
            wobbleLevel: document.getElementById('wobbleLevel'),
            blurLevel: document.getElementById('blurLevel'),
            inkOpacity: document.getElementById('inkOpacity'),
            color: document.getElementById('stampColor'),
            agingTexture: document.getElementById('agingTexture'),
            agingIntensity: document.getElementById('agingIntensity'),
            agingScale: document.getElementById('agingScale')
        };

        this.displays = {
            topSize: document.getElementById('topFontSizeValue'),
            bottomSize: document.getElementById('bottomFontSizeValue'),
            topSpacing: document.getElementById('topLetterSpacingValue'),
            bottomSpacing: document.getElementById('bottomLetterSpacingValue'),
            topRadius: document.getElementById('topTextRadiusValue'),
            bottomRadius: document.getElementById('bottomTextRadiusValue'),
            starSize: document.getElementById('starSizeValue'),
            circleWidth: document.getElementById('circleWidthValue'),
            stampSize: document.getElementById('stampSizeValue'),
            wobbleLevel: document.getElementById('wobbleLevelValue'),
            blurLevel: document.getElementById('blurLevelValue'),
            inkOpacity: document.getElementById('inkOpacityValue'),
            agingIntensity: document.getElementById('agingIntensityValue'),
            agingScale: document.getElementById('agingScaleValue')
        };

        this.downloadBtn = document.getElementById('downloadBtn');
        this.resetBtn = document.getElementById('resetBtn');

        this.renderPending = false;
        this.scale = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.stampWrapper = document.querySelector('.stamp-wrapper');

        this.loadSettings();
        this.initEventListeners();
        this.requestRender();
    }

    loadBackgroundImage() {
        const img = new Image();
        img.onload = () => {
            this.backgroundImage = img;
            this.requestRender();
        };
        img.onerror = () => {
            console.error('Не удалось загрузить фоновое изображение');
        };
        img.src = 'o3iZzaY.jpeg';
    }

    defaultSettings() {
        return {
            blurLevel: 2,
            agingIntensity: 40,
            agingScale: 110,
            wobbleLevel: 80,
            stampSize: 400
        };
    }

    formatDisplay(key, value) {
        if (key === 'blurLevel') return `${(value / 10).toFixed(1)}px`;
        if (key.includes('Size') || key.includes('Width')) return `${value}px`;
        if (key.includes('Radius') || key.includes('Level') || key.includes('Opacity') || key.includes('Texture') || key.includes('Scale') || key.includes('Intensity') || key.includes('Wobble')) {
            return `${value}%`;
        }
        return value;
    }

    initEventListeners() {
        Object.keys(this.inputs).forEach(key => {
            const el = this.inputs[key];
            if (!el) return;
            const eventType = (el.tagName === 'SELECT' || el.type === 'color') ? 'change' : 'input';

            el.addEventListener(eventType, (e) => {
                if (this.displays[key]) {
                    const val = e.target.value;
                    this.displays[key].textContent = this.formatDisplay(key, val);
                }

                if (['stampSize', 'blurLevel', 'agingScale', 'agingIntensity'].includes(key)) {
                    this.textures.noiseMap = null;
                    this.textures.variationMap = null;
                    this.textures.paperTexture = null;
                    this.textures.wearMap = null;
                    this.textures.grungeMask = null;
                    this.textures.agingTexture = null;
                }

                if (key === 'stampSize') {
                    this.scale = 1.0;
                    this.offsetX = 0;
                    this.offsetY = 0;
                    this.applyTransform();
                }
                this.saveSettings();
                this.requestRender();
            });
        });

        this.downloadBtn.addEventListener('click', () => this.downloadStamp());
        this.resetBtn.addEventListener('click', () => this.resetSettings());
        this.initCanvasInteraction();
    }

    initCanvasInteraction() {
        if (!this.stampWrapper) return;

        const preview = document.querySelector('.preview');
        if (!preview) return;

        preview.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
        preview.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    }

    requestRender() {
        if (!this.renderPending) {
            this.renderPending = true;
            requestAnimationFrame(() => {
                this.generateStamp();
                this.renderPending = false;
            });
        }
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('stampSettingsV4.0');
            if (saved) {
                const settings = JSON.parse(saved);
                Object.keys(settings).forEach(key => {
                    if (this.inputs[key]) {
                        this.inputs[key].value = settings[key];
                        if (this.displays[key]) {
                            this.displays[key].textContent = this.formatDisplay(key, settings[key]);
                        }
                    }
                });
            } else {
                const defaults = this.defaultSettings();
                Object.keys(defaults).forEach(key => {
                    if (this.inputs[key]) {
                        this.inputs[key].value = defaults[key];
                        if (this.displays[key]) this.displays[key].textContent = this.formatDisplay(key, defaults[key]);
                    }
                });
            }
        } catch (e) { console.error(e); }
    }

    saveSettings() {
        const settings = {};
        Object.keys(this.inputs).forEach(key => settings[key] = this.inputs[key].value);
        localStorage.setItem('stampSettingsV4.0', JSON.stringify(settings));
    }

    resetSettings() {
        localStorage.removeItem('stampSettingsV4.0');
        location.reload();
    }

    applyTransform() {
        if (this.stampWrapper) {
            this.stampWrapper.style.transform = `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`;
        }
    }

    handleWheel(e) {
        e.preventDefault();

        const rect = this.stampWrapper.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.5, Math.min(5.0, this.scale * delta));

        const scaleChange = newScale / this.scale;
        this.offsetX = mouseX - (mouseX - this.offsetX) * scaleChange;
        this.offsetY = mouseY - (mouseY - this.offsetY) * scaleChange;

        this.scale = newScale;
        this.applyTransform();
    }

    handleMouseDown(e) {
        if (e.button === 0) {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            e.preventDefault();
        }
    }

    handleMouseMove(e) {
        if (this.isDragging) {
            const deltaX = e.clientX - this.lastMouseX;
            const deltaY = e.clientY - this.lastMouseY;

            this.offsetX += deltaX;
            this.offsetY += deltaY;

            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;

            this.applyTransform();
        }
    }

    handleMouseUp(e) {
        if (e.button === 0) {
            this.isDragging = false;
        }
    }

    val(key) {
        const el = this.inputs[key];
        if (!el) return null;
        return (el.type === 'range' || el.type === 'number') ? parseFloat(el.value) : el.value;
    }

    getNoiseMap(width, height, baseWidth = null, baseHeight = null) {
        const noiseWidth = baseWidth || width;
        const noiseHeight = baseHeight || height;
        const scaleFactorX = width / noiseWidth;
        const scaleFactorY = height / noiseHeight;
        const cacheKey = `${width}x${height}_${noiseWidth}x${noiseHeight}`;
        if (this.textures.noiseMap && this.textures.noiseMap.key === cacheKey) {
            return this.textures.noiseMap.canvas;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        const scale = 0.02;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const nx = x / scaleFactorX;
                const ny = y / scaleFactorY;
                const noise = this.simplex.octaveNoise(nx * scale, ny * scale, 3, 0.6, 0.5);
                const val = Math.floor((noise + 1) * 0.5 * 255);
                data[idx] = val;
                data[idx + 1] = val;
                data[idx + 2] = val;
                data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const fCtx = finalCanvas.getContext('2d');
        fCtx.filter = 'contrast(180%) brightness(95%)';
        fCtx.drawImage(canvas, 0, 0);

        this.textures.noiseMap = { canvas: finalCanvas, key: cacheKey };
        return finalCanvas;
    }

    getPaperTexture(width, height, baseWidth = null, baseHeight = null) {
        const noiseWidth = baseWidth || width;
        const noiseHeight = baseHeight || height;
        const scaleFactorX = width / noiseWidth;
        const scaleFactorY = height / noiseHeight;
        const cacheKey = `paper_${width}x${height}_${noiseWidth}x${noiseHeight}`;
        if (this.textures.paperTexture && this.textures.paperTexture.key === cacheKey) {
            return this.textures.paperTexture.canvas;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        const scale1 = 0.15;
        const scale2 = 0.05;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const nx = x / scaleFactorX;
                const ny = y / scaleFactorY;
                const noise1 = this.simplexPaper.octaveNoise(nx * scale1, ny * scale1, 2, 0.5, 1.0);
                const noise2 = this.simplexPaper.octaveNoise(nx * scale2, ny * scale2, 3, 0.7, 0.3);
                const combined = (noise1 * 0.6 + noise2 * 0.4 + 1) * 0.5;
                const val = Math.floor(combined * 255);
                data[idx] = val;
                data[idx + 1] = val;
                data[idx + 2] = val;
                data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        this.textures.paperTexture = { canvas: canvas, key: cacheKey };
        return canvas;
    }

    getWearMap(width, height, intensity, baseWidth = null, baseHeight = null) {
        const noiseWidth = baseWidth || width;
        const noiseHeight = baseHeight || height;
        const scaleFactorX = width / noiseWidth;
        const scaleFactorY = height / noiseHeight;
        const cacheKey = `wear_${width}x${height}_${intensity}_${noiseWidth}x${noiseHeight}`;
        if (this.textures.wearMap && this.textures.wearMap.key === cacheKey) {
            return this.textures.wearMap.canvas;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        const cx = width / 2;
        const cy = height / 2;
        const maxDist = Math.sqrt(cx * cx + cy * cy);

        const scale1 = 0.03;
        const scale2 = 0.08;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const dx = x - cx;
                const dy = y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;

                const nx = x / scaleFactorX;
                const ny = y / scaleFactorY;
                const noise1 = this.simplexWear.octaveNoise(nx * scale1, ny * scale1, 4, 0.6, 0.5);
                const noise2 = this.simplexWear.octaveNoise(nx * scale2, ny * scale2, 2, 0.5, 1.2);
                const combined = (noise1 * 0.7 + noise2 * 0.3 + 1) * 0.5;

                const edgeFactor = Math.max(0, 1 - dist * 1.2);
                const centerFactor = Math.max(0, 1 - Math.abs(dist - 0.3) * 2);
                const wearFactor = (combined * 0.6 + (1 - edgeFactor) * 0.2 + centerFactor * 0.2);

                const val = Math.floor(wearFactor * 255 * intensity);
                data[idx] = val;
                data[idx + 1] = val;
                data[idx + 2] = val;
                data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const fCtx = finalCanvas.getContext('2d');
        fCtx.filter = 'blur(2px) contrast(150%)';
        fCtx.drawImage(canvas, 0, 0);

        this.textures.wearMap = { canvas: finalCanvas, key: cacheKey };
        return finalCanvas;
    }

    getVariationMap(width, height, baseWidth = null, baseHeight = null) {
        const noiseWidth = baseWidth || width;
        const noiseHeight = baseHeight || height;
        const scaleFactorX = width / noiseWidth;
        const scaleFactorY = height / noiseHeight;
        const cacheKey = `${width}x${height}_${noiseWidth}x${noiseHeight}`;
        if (this.textures.variationMap && this.textures.variationMap.key === cacheKey) {
            return this.textures.variationMap.canvas;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        const scale = 0.04;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const nx = x / scaleFactorX;
                const ny = y / scaleFactorY;
                const noise = this.simplex.octaveNoise(nx * scale, ny * scale, 3, 0.65, 0.8);
                const val = Math.floor((noise + 1) * 0.5 * 255);
                data[idx] = val;
                data[idx + 1] = val;
                data[idx + 2] = val;
                data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = width;
        finalCanvas.height = height;
        const fCtx = finalCanvas.getContext('2d');
        fCtx.filter = 'blur(6px) contrast(220%) brightness(110%)';
        fCtx.drawImage(canvas, 0, 0);

        this.textures.variationMap = { canvas: finalCanvas, key: cacheKey };
        return finalCanvas;
    }

    getAgingTexture(type, width, height, scalePercent, baseWidth = null, baseHeight = null) {
        const scale = scalePercent / 100;
        const noiseWidth = baseWidth || width;
        const noiseHeight = baseHeight || height;
        const scaleFactorX = width / noiseWidth;
        const scaleFactorY = height / noiseHeight;
        const cacheKey = `${type}_${width}x${height}_${scale.toFixed(2)}_${noiseWidth}x${noiseHeight}`;
        if (this.textures.agingTexture && this.textures.agingTexture.key === cacheKey) {
            return this.textures.agingTexture.canvas;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        let settings;
        switch (type) {
            case 'linen':
                settings = { scale1: 0.35, scale2: 0.12, octaves: 2, persistence: 0.9 };
                break;
            case 'dust':
                settings = { scale1: 0.7, scale2: 0.28, octaves: 4, persistence: 0.65 };
                break;
            default:
                settings = { scale1: 0.18, scale2: 0.05, octaves: 3, persistence: 0.7 };
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const nx = x / scaleFactorX;
                const ny = y / scaleFactorY;
                const n1 = this.simplexAging.octaveNoise(nx * settings.scale1 * scale, ny * settings.scale1 * scale, settings.octaves, settings.persistence, 0.8);
                const n2 = this.simplexAging.octaveNoise(nx * settings.scale2 * scale, ny * settings.scale2 * scale, settings.octaves + 1, settings.persistence - 0.1, 1.2);
                const val = Math.floor(((n1 * 0.6 + n2 * 0.4) + 1) * 0.5 * 255);
                data[idx] = val;
                data[idx + 1] = val;
                data[idx + 2] = val;
                data[idx + 3] = 255;
            }
        }

        ctx.putImageData(imgData, 0, 0);
        this.textures.agingTexture = { canvas, key: cacheKey };
        return canvas;
    }

    generateStamp() {
        const size = this.val('stampSize');

        if (this.canvas.width !== size || this.canvas.height !== size) {
            this.canvas.width = size;
            this.canvas.height = size;
        }

        this.renderToContext(this.ctx, size, 1);
    }

    renderToContext(ctx, size, scale, baseSize = null) {
        const textureBaseSize = size; // Всегда используем размер целевого canvas для текстур
        const options = this.collectOptions(scale, size, textureBaseSize);
        ctx.clearRect(0, 0, size, size);

        const baseCanvas = document.createElement('canvas');
        baseCanvas.width = size;
        baseCanvas.height = size;
        const baseCtx = baseCanvas.getContext('2d');

        // Сохраняем маску ДО эффектов
        this.configureFilters(options);
        this.drawStampBase(baseCtx, options);

        const stampMask = document.createElement('canvas');
        stampMask.width = size;
        stampMask.height = size;
        stampMask.getContext('2d').drawImage(baseCanvas, 0, 0);

        this.applyInkVariation(baseCtx, options);
        this.applyAgingAndWear(baseCtx, options);

        // Финальная обрезка
        baseCtx.globalCompositeOperation = 'destination-in';
        baseCtx.drawImage(stampMask, 0, 0);
        baseCtx.globalCompositeOperation = 'source-over';

        ctx.drawImage(baseCanvas, 0, 0);
    }

    collectOptions(scale, size, textureBaseSize = null) {
        const getVal = (key, defaultValue = 0) => {
            const val = this.val(key);
            return val !== null && val !== undefined ? val : defaultValue;
        };
        
        const getStringVal = (key, defaultValue = '') => {
            const val = this.val(key);
            return val !== null && val !== undefined ? val : defaultValue;
        };

        return {
            size,
            scale,
            textureBaseSize: textureBaseSize || size,
            cx: size / 2,
            cy: size / 2,
            mainColor: getStringVal('color', '#cf3030'),
            blurLevel: getVal('blurLevel', 2),
            wobbleLevel: getVal('wobbleLevel', 80) / 100,
            circleWidth: getVal('circleWidth', 8) * scale,
            mainRadius: (size / 2) - (10 * scale) - (getVal('circleWidth', 8) * scale / 2),
            inkOpacity: getVal('inkOpacity', 96) / 100,
            inkVariation: (getVal('blurLevel', 2) / 30) * 0.5,
            top: {
                text: getStringVal('topText', ''),
                font: getStringVal('topFont', 'Noto Sans SC'),
                size: getVal('topSize', 32) * scale,
                spacing: getVal('topSpacing', 0.7),
                radius: (getVal('topRadius', 84) / 100) * ((size / 2) - 20)
            },
            bottom: {
                text: getStringVal('bottomText', ''),
                font: getStringVal('bottomFont', 'Noto Sans SC'),
                size: getVal('bottomSize', 28) * scale,
                spacing: getVal('bottomSpacing', 0.6),
                radius: (getVal('bottomRadius', 82) / 100) * ((size / 2) - 20)
            },
            starSize: getVal('starSize', 80) * scale,
            agingTexture: getStringVal('agingTexture', 'paper'),
            agingIntensity: getVal('agingIntensity', 40) / 100,
            agingScale: getVal('agingScale', 110)
        };
    }

    configureFilters(options) {
        if (this.distortionMap) {
            const distortion = options.wobbleLevel * 10 * options.scale;
            this.distortionMap.setAttribute('scale', distortion.toString());
        }

        if (this.distressedTurbulence && this.distressedDisplacement && this.distressedSaturate) {
            const distressedIntensity = Math.min(1.0, options.wobbleLevel * 0.8);
            if (distressedIntensity > 0) {
                const baseFreq = 0.03 + (distressedIntensity * 0.04);
                const scale = 3 + (distressedIntensity * 8);
                const saturation = 0.6 + (distressedIntensity * 0.3);

                this.distressedTurbulence.setAttribute('baseFrequency', baseFreq.toString());
                this.distressedDisplacement.setAttribute('scale', scale.toString());
                this.distressedSaturate.setAttribute('values', saturation.toString());
            }
        }

        if (this.turbulence && options.wobbleLevel > 0) {
            const baseFreq = 0.03 + (options.wobbleLevel * 0.02);
            this.turbulence.setAttribute('baseFrequency', baseFreq.toString());
        }

        if (this.distortionMap && options.wobbleLevel > 0) {
            this.distortionMap.setAttribute('scale', (options.wobbleLevel * 3).toString());
        }
    }

    drawStampBase(ctx, opt) {
        ctx.save();
        ctx.filter = `url(#ink-bleed)`;

        ctx.strokeStyle = opt.mainColor;
        ctx.lineWidth = opt.circleWidth;
        ctx.globalAlpha = opt.inkOpacity;
        this.drawWobblyCircle(ctx, opt.cx, opt.cy, opt.mainRadius, opt.circleWidth, opt.mainColor, opt.wobbleLevel * 0.6);

        ctx.lineWidth = opt.circleWidth / 2;
        this.drawWobblyCircle(ctx, opt.cx, opt.cy, opt.mainRadius - (opt.circleWidth * 1.2), opt.circleWidth / 2, opt.mainColor, opt.wobbleLevel * 0.6);

        if (opt.starSize > 2) {
            ctx.fillStyle = opt.mainColor;
            this.drawWobblyStar(ctx, opt.cx, opt.cy, opt.starSize / 2, 5, opt.mainColor, opt.wobbleLevel * 0.6);
        }

        ctx.fillStyle = opt.mainColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        this.drawCircularText(ctx, opt.top.text, opt.cx, opt.cy, opt.top.radius, opt.top.size, opt.top.spacing, opt.top.font, true);
        this.drawCircularText(ctx, opt.bottom.text, opt.cx, opt.cy, opt.bottom.radius, opt.bottom.size, opt.bottom.spacing, opt.bottom.font, false);

        ctx.restore();
    }

    applyInkVariation(ctx, opt) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.globalAlpha = Math.min(0.35, opt.inkVariation + 0.08);
        const noise = this.getNoiseMap(opt.size, opt.size, opt.textureBaseSize, opt.textureBaseSize);
        ctx.drawImage(noise, 0, 0);
        ctx.restore();

        if (opt.blurLevel > 0) {
            const blurCanvas = document.createElement('canvas');
            blurCanvas.width = opt.size;
            blurCanvas.height = opt.size;
            const blurCtx = blurCanvas.getContext('2d');
            blurCtx.filter = `blur(${(opt.blurLevel / 10) * opt.scale}px)`;
            blurCtx.drawImage(ctx.canvas, 0, 0);
            ctx.clearRect(0, 0, opt.size, opt.size);
            ctx.drawImage(blurCanvas, 0, 0);
        }
    }

    applyTextureToStampOnly(ctx, textureFunction) {
        const size = ctx.canvas.width;

        // 1. Создаём бинарную маску (только полностью непрозрачные пиксели)
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = size;
        maskCanvas.height = size;
        const maskCtx = maskCanvas.getContext('2d');

        // Копируем оригинал
        maskCtx.drawImage(ctx.canvas, 0, 0);

        // Усиливаем контраст альфа-канала для чёткой маски
        const maskData = maskCtx.getImageData(0, 0, size, size);
        const threshold = 15; // Порог отсечения
        for (let i = 3; i < maskData.data.length; i += 4) {
            maskData.data[i] = maskData.data[i] > threshold ? 255 : 0;
        }
        maskCtx.putImageData(maskData, 0, 0);

        // 2. Применяем текстуру на временном canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = size;
        tempCanvas.height = size;
        const tempCtx = tempCanvas.getContext('2d');

        // Сначала рисуем оригинальную печать
        tempCtx.drawImage(ctx.canvas, 0, 0);

        // Применяем текстурную функцию
        textureFunction(tempCtx);

        // 3. КРИТИЧНО: обрезаем по бинарной маске
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(maskCanvas, 0, 0);
        tempCtx.globalCompositeOperation = 'source-over';

        // 4. Очищаем и рисуем результат
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(tempCanvas, 0, 0);
    }

    applyAgingAndWear(ctx, opt) {
        const size = ctx.canvas.width;

        // Сохраняем чистую маску печати В САМОМ НАЧАЛЕ
        const originalMask = document.createElement('canvas');
        originalMask.width = size;
        originalMask.height = size;
        const maskCtx = originalMask.getContext('2d');
        maskCtx.drawImage(ctx.canvas, 0, 0);

        if (opt.agingIntensity > 0) {
            const agingTexture = this.getAgingTexture(opt.agingTexture, size, size, opt.agingScale, opt.textureBaseSize, opt.textureBaseSize);

            // Сохраняем текущее состояние печати
            const stampImageData = ctx.getImageData(0, 0, size, size);
            const stampData = stampImageData.data;

            // Получаем данные текстуры
            const tempCtx = document.createElement('canvas').getContext('2d');
            tempCtx.canvas.width = size;
            tempCtx.canvas.height = size;
            tempCtx.drawImage(agingTexture, 0, 0);
            const textureData = tempCtx.getImageData(0, 0, size, size).data;

            // Применяем multiply только к непрозрачным пикселям
            for (let i = 0; i < stampData.length; i += 4) {
                if (stampData[i + 3] > 0) { // Только если пиксель непрозрачный
                    const factor = textureData[i] / 255; // Grayscale value
                    const blend = 1 - (1 - factor) * opt.agingIntensity;
                    stampData[i] = Math.round(stampData[i] * blend);
                    stampData[i + 1] = Math.round(stampData[i + 1] * blend);
                    stampData[i + 2] = Math.round(stampData[i + 2] * blend);
                    // Alpha остаётся без изменений
                }
            }

            ctx.putImageData(stampImageData, 0, 0);
        }

        if (opt.wobbleLevel > 0.1) {
            const distressedIntensity = Math.min(0.4, opt.wobbleLevel * 0.5);
            if (distressedIntensity > 0.05) {
                this.applyDistressedFilter(ctx, distressedIntensity);
            }
        }

        // В САМОМ КОНЦЕ — финальная обрезка по оригинальной маске
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(originalMask, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
    }

    applyVignette(ctx, intensity) {
        const size = ctx.canvas.width;
        const gradientCanvas = document.createElement('canvas');
        gradientCanvas.width = size;
        gradientCanvas.height = size;
        const gCtx = gradientCanvas.getContext('2d');
        const gradient = gCtx.createRadialGradient(size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.55);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, `rgba(0,0,0,${intensity * 0.8})`);
        gCtx.fillStyle = gradient;
        gCtx.fillRect(0, 0, size, size);

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(gradientCanvas, 0, 0);
        ctx.restore();
    }

    getHighFreqNoise(width, height, intensity, baseWidth = null, baseHeight = null) {
        const noiseWidth = baseWidth || width;
        const noiseHeight = baseHeight || height;
        const scaleFactorX = width / noiseWidth;
        const scaleFactorY = height / noiseHeight;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(width, height);
        const data = imgData.data;

        const scale = 0.25;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const nx = x / scaleFactorX;
                const ny = y / scaleFactorY;
                const noise = this.simplex.noise(nx * scale, ny * scale);
                const threshold = 0.3;
                if (noise > threshold) {
                    const alpha = ((noise - threshold) / (1 - threshold)) * intensity * 255;
                    data[idx + 3] = Math.min(255, alpha);
                } else {
                    data[idx + 3] = 0;
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    getGrungeMask(width, height, intensity, baseWidth = null, baseHeight = null) {
        const noiseWidth = baseWidth || width;
        const noiseHeight = baseHeight || height;
        const scaleFactorX = width / noiseWidth;
        const scaleFactorY = height / noiseHeight;
        const cacheKey = `grunge_${width}x${height}_${intensity}_${noiseWidth}x${noiseHeight}`;
        if (this.textures.grungeMask && this.textures.grungeMask.key === cacheKey) {
            return this.textures.grungeMask.canvas;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        const imgData = tempCtx.createImageData(width, height);
        const data = imgData.data;

        const scale1 = 0.03;
        const scale2 = 0.12;
        const scale3 = 0.25;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;

                const nx = x / scaleFactorX;
                const ny = y / scaleFactorY;
                const noise1 = this.simplexWear.octaveNoise(nx * scale1, ny * scale1, 3, 0.6, 0.5);
                const noise2 = this.simplexWear.octaveNoise(nx * scale2, ny * scale2, 2, 0.5, 1.0);
                const noise3 = this.simplexWear.noise(nx * scale3, ny * scale3);

                const combined = (noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2 + 1) * 0.5;
                const threshold = 0.4 + (intensity * 0.3);

                if (combined < threshold) {
                    const alpha = ((threshold - combined) / threshold) * intensity * 255;
                    data[idx] = 0;
                    data[idx + 1] = 0;
                    data[idx + 2] = 0;
                    data[idx + 3] = Math.min(255, alpha);
                } else {
                    data[idx + 3] = 0;
                }
            }
        }

        tempCtx.putImageData(imgData, 0, 0);

        ctx.filter = 'blur(1.5px) contrast(180%)';
        ctx.drawImage(tempCanvas, 0, 0);

        this.textures.grungeMask = { canvas: canvas, key: cacheKey };
        return canvas;
    }

    applyTextureMask(ctx, maskCanvas, intensity) {
        if (!maskCanvas || intensity <= 0) return;

        const size = ctx.canvas.width;
        const stampData = ctx.getImageData(0, 0, size, size);
        const tempCtx = document.createElement('canvas').getContext('2d');
        tempCtx.canvas.width = size;
        tempCtx.canvas.height = size;
        tempCtx.drawImage(maskCanvas, 0, 0);
        const maskData = tempCtx.getImageData(0, 0, size, size);

        for (let i = 0; i < stampData.data.length; i += 4) {
            const stampAlpha = stampData.data[i + 3];
            if (stampAlpha > 0) {
                const maskAlpha = maskData.data[i + 3] / 255;
                const reduction = maskAlpha * intensity;
                stampData.data[i + 3] = Math.max(0, stampAlpha - (stampAlpha * reduction));
            }
        }

        ctx.putImageData(stampData, 0, 0);
    }

    applyDistressedFilter(ctx, intensity) {
        if (intensity <= 0) return;

        const size = ctx.canvas.width;
        const stampData = ctx.getImageData(0, 0, size, size);

        const filterCanvas = document.createElement('canvas');
        filterCanvas.width = size;
        filterCanvas.height = size;
        const filterCtx = filterCanvas.getContext('2d');

        filterCtx.putImageData(stampData, 0, 0);
        filterCtx.filter = `url(#distressed-stamp)`;
        filterCtx.drawImage(filterCanvas, 0, 0);

        const filteredData = filterCtx.getImageData(0, 0, size, size);

        for (let i = 0; i < stampData.data.length; i += 4) {
            const originalAlpha = stampData.data[i + 3];
            const filteredAlpha = filteredData.data[i + 3];

            if (originalAlpha > 0) {
                const blend = originalAlpha * (1 - intensity) + filteredAlpha * intensity;
                stampData.data[i + 3] = Math.max(0, Math.min(255, blend));
            }
        }

        ctx.putImageData(stampData, 0, 0);
    }

    drawStar(ctx, cx, cy, radius, points, color) {
        const outerRadius = radius;
        const innerRadius = radius * 0.38;
        ctx.fillStyle = color;

        const path = [];
        for (let i = 0; i < points * 2; i++) {
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const r = i % 2 === 0 ? outerRadius : innerRadius;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            path.push({ x, y });
        }

        ctx.beginPath();
        for (let i = 0; i < path.length; i++) {
            const p = path[i];
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.fill();
    }

    drawWobblyStar(ctx, cx, cy, radius, points, color, wobbleIntensity = 0.3) {
        const outerRadius = radius;
        const innerRadius = radius * 0.38;
        ctx.fillStyle = color;

        const path = [];
        for (let i = 0; i < points * 2; i++) {
            const angle = (i * Math.PI) / points - Math.PI / 2;
            const r = i % 2 === 0 ? outerRadius : innerRadius;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            path.push({ x, y, angle });
        }

        ctx.beginPath();
        for (let i = 0; i < path.length; i++) {
            const p = path[i];
            const noise = this.simplex.noise(p.x * 0.08, p.y * 0.08) * 0.8;
            const wobble = noise * wobbleIntensity;
            const x = p.x + Math.cos(p.angle + Math.PI / 2) * wobble;
            const y = p.y + Math.sin(p.angle + Math.PI / 2) * wobble;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
    }

    drawWobblyCircle(ctx, cx, cy, radius, lineWidth, color, wobbleIntensity = 0.3) {
        const segments = Math.max(64, Math.floor(radius * 2));
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;

        ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const baseX = cx + Math.cos(angle) * radius;
            const baseY = cy + Math.sin(angle) * radius;

            const noise = this.simplex.noise(baseX * 0.05, baseY * 0.05) * 0.8;
            const wobble = noise * wobbleIntensity;
            const x = baseX + Math.cos(angle + Math.PI / 2) * wobble;
            const y = baseY + Math.sin(angle + Math.PI / 2) * wobble;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
    }

    drawCircularText(ctx, text, cx, cy, radius, fontSize, spacing, font, isTop) {
        if (!text) return;
        ctx.font = `bold ${fontSize}px ${font}, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const baseAngle = (Math.PI * 1.4) / (text.length || 1);
        const anglePerChar = baseAngle * spacing;
        const totalAngle = anglePerChar * (text.length - 1);
        let startAngle = isTop
            ? -Math.PI / 2 - totalAngle / 2
            : Math.PI / 2 - totalAngle / 2;
        const chars = isTop ? text.split('') : text.split('').reverse();
        chars.forEach((char, i) => {
            const angle = startAngle + anglePerChar * i;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(isTop ? angle + Math.PI / 2 : angle - Math.PI / 2);
            ctx.fillText(char, 0, 0);
            ctx.restore();
        });
    }

    downloadStamp() {
        const resolution = parseInt(this.val('resolution'));
        const baseSize = this.val('stampSize');
        const exportSize = baseSize * resolution;

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = exportSize;
        exportCanvas.height = exportSize;
        const exportCtx = exportCanvas.getContext('2d');

        // Сбрасываем кэш текстур
        this.textures.noiseMap = null;
        this.textures.variationMap = null;
        this.textures.paperTexture = null;
        this.textures.wearMap = null;
        this.textures.grungeMask = null;
        this.textures.agingTexture = null;

        // Рендерим в высоком разрешении
        this.renderToContext(exportCtx, exportSize, resolution);

        // Сбрасываем кэш и обновляем превью
        this.textures.noiseMap = null;
        this.textures.variationMap = null;
        this.textures.paperTexture = null;
        this.textures.wearMap = null;
        this.textures.grungeMask = null;
        this.textures.agingTexture = null;

        // ДОБАВЬ ЭТО - обновление превью после экспорта
        this.requestRender();

        const link = document.createElement('a');
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        link.download = `stamp_${baseSize}px_${resolution}x_${timestamp}.png`;
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.stampGenerator = new StampGenerator();
});
