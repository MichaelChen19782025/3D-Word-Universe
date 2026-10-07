/**
 * 3D单词宇宙 - 双层发光蒙版 Canvas 纹理生成与 3D 卡片网格工坊
 * 具有离屏 Canvas 缓存、Extrude 挤出几何复用池与防显存泄漏机制
 */

const CARD_CANVAS_CACHE_MAX = IS_MOBILE_DEVICE ? 400 : 1200;
const OVERLAY_CANVAS_CACHE_MAX = 20;

const _cardCanvasCache = new Map();
const _overlayCanvasCache = new Map();
const _cardGeoCache = new Map();

let _sharedTestCanvas = null;
let _sharedTestCtx = null;

function getSharedTestContext() {
    if (!_sharedTestCanvas) {
        _sharedTestCanvas = document.createElement('canvas');
        _sharedTestCtx = _sharedTestCanvas.getContext('2d');
    }
    return _sharedTestCtx;
}

function clearCardCanvasCache() { _cardCanvasCache.clear(); }
function clearOverlayCanvasCache() { _overlayCanvasCache.clear(); }

function finalizeCanvasTexture(canvas, maxAnisotropy = 8) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    if (appState.renderer) {
        const aniso = appState.renderer.capabilities.getMaxAnisotropy();
        tex.anisotropy = Math.min(maxAnisotropy, aniso);
    }
    return tex;
}

function disposeObject(obj) {
    if (!obj) return;
    const mats = obj.material ? (Array.isArray(obj.material) ? obj.material : [obj.material]) : [];
    for (let i = 0; i < mats.length; i++) {
        const m = mats[i];
        if (!m) continue;
        if (m.map) m.map.dispose();
        if (m.emissiveMap) m.emissiveMap.dispose();
        m.dispose();
    }
    if (obj.userData && obj.userData.hoverSideMaterial) {
        obj.userData.hoverSideMaterial.dispose();
    }
}

const AppCardFactory = {
    clearCaches() {
        clearCardCanvasCache();
        clearOverlayCanvasCache();
        _cardGeoCache.clear();
    },

    createCardTexture(word) {
        const baseFontSize = APP_CONFIG.DEFAULT_SPHERE_CARD_FONT_SIZE;
        const dpr = window.devicePixelRatio || 1;
        let textureResolutionScale = IS_MOBILE_DEVICE ? Math.min(dpr, 1.8) : 1.0;

        let fontFactor = appState.currentSphereCardFontSizeFactor || 1.0;
        const rawFontSize = Math.round(baseFontSize * fontFactor * textureResolutionScale);
        const fontSelect = document.getElementById('sphereCardFontFamily');
        const fontFamily = fontSelect ? fontSelect.value : "'Microsoft YaHei', sans-serif";

        const stormStyleCb = document.getElementById('stormWordCardStyleEnabled');
        const isStormStyled = word.isStormWord && stormStyleCb && stormStyleCb.checked;
        const fontColor = isStormStyled ?
            document.getElementById('stormWordCardFontColor')?.value || '#000000' :
            document.getElementById('sphereCardFontColor')?.value || '#ffffff';

        const cardStyle = (isStormStyled ? APP_CONFIG.CARD_STYLES.find(s => s.id === 'ember') : null)
            || APP_CONFIG.CARD_STYLES.find(s => s.id === appState.currentCardStyleId)
            || APP_CONFIG.CARD_STYLES[0];

        const displayWordRaw = appState.showEnglish ? (word.words || 'N/A') : ((word.chinese || '').split(/,|，/)[0] || 'N/A');

        const cacheKey = [displayWordRaw, rawFontSize, fontFamily, fontColor, isStormStyled ? 's' : 'n', cardStyle.id].join('\u0001');
        const cached = _cardCanvasCache.get(cacheKey);
        if (cached && cached.base) {
            const tex = finalizeCanvasTexture(cached.base, 8);
            const emissiveTex = finalizeCanvasTexture(cached.emissive, 8);
            return {
                texture: tex,
                emissiveTexture: emissiveTex,
                pxWidth: cached.base.width,
                pxHeight: cached.base.height,
                resolutionScale: textureResolutionScale
            };
        }

        const testContext = getSharedTestContext();
        testContext.font = `bold ${rawFontSize}px ${fontFamily}`;

        let mainContentLines = [];
        if (appState.showEnglish) {
            const words = displayWordRaw.split(' ');
            let currentLine = '';
            for (let wd of words) {
                if (testContext.measureText(currentLine + (currentLine ? ' ' : '') + wd).width > (rawFontSize * APP_CONFIG.MAX_CHARS_PER_LINE_EN * 0.78) && currentLine) {
                    mainContentLines.push(currentLine);
                    currentLine = wd;
                } else {
                    currentLine += (currentLine ? ' ' : '') + wd;
                }
            }
            if (currentLine) mainContentLines.push(currentLine);
        } else {
            let currentLine = '';
            for (let char of displayWordRaw) {
                if (testContext.measureText(currentLine + char).width > (rawFontSize * APP_CONFIG.MAX_CHARS_PER_LINE_CN * 1.18) && currentLine) {
                    mainContentLines.push(currentLine);
                    currentLine = char;
                } else {
                    currentLine += char;
                }
            }
            if (currentLine) mainContentLines.push(currentLine);
        }
        if (mainContentLines.length === 0 && displayWordRaw.length > 0) mainContentLines.push(displayWordRaw);

        const mainTextWidth = Math.max(...mainContentLines.map(line => testContext.measureText(line).width), 0);
        let padding = rawFontSize * 0.95;
        let lineHeight = rawFontSize * 1.3;
        let canvasWidth = Math.max(200 * textureResolutionScale, mainTextWidth + padding * 3.2);
        const mainTextHeight = mainContentLines.length * lineHeight;
        let canvasHeight = Math.max(92 * textureResolutionScale, mainTextHeight + padding * 2);

        const MAX_TEXTURE_SIZE = IS_MOBILE_DEVICE ? 512 : 1024;
        const downScale = Math.min(1, MAX_TEXTURE_SIZE / Math.max(canvasWidth, canvasHeight));
        canvasWidth = Math.round(canvasWidth * downScale) || 200;
        canvasHeight = Math.round(canvasHeight * downScale) || 92;

        const scaledFontSize = Math.round(rawFontSize * downScale);
        const scaledLineHeight = lineHeight * downScale;

        // 可见层画布
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const context = canvas.getContext('2d');
        context.font = `bold ${scaledFontSize}px ${fontFamily}`;

        // 发光蒙版画布（Emissive Mask）
        const emissiveCanvas = document.createElement('canvas');
        emissiveCanvas.width = canvasWidth;
        emissiveCanvas.height = canvasHeight;
        const ectx = emissiveCanvas.getContext('2d');
        ectx.font = `bold ${scaledFontSize}px ${fontFamily}`;

        const theme = cardStyle;

        function drawRoundedRect(ctx, x, y, width, height, radius) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
        }

        function drawCornerBracket(ctx, x, y, dx, dy, len, lw) {
            ctx.beginPath();
            ctx.moveTo(x + dx * len, y);
            ctx.lineTo(x, y);
            ctx.lineTo(x, y + dy * len);
            ctx.stroke();
        }

        // 1. 三段金属渐变基底
        const bgGrad = context.createLinearGradient(0, 0, 0, canvasHeight);
        bgGrad.addColorStop(0, theme.bgTop);
        bgGrad.addColorStop(0.5, theme.bgMid);
        bgGrad.addColorStop(1, theme.bgBot);
        context.fillStyle = bgGrad;
        context.fillRect(0, 0, canvasWidth, canvasHeight);

        // 2. 噪点颗粒质感
        for (let i = 0; i < canvasWidth * canvasHeight * 0.015; i++) {
            const gx = Math.random() * canvasWidth;
            const gy = Math.random() * canvasHeight;
            context.fillStyle = `rgba(255, 255, 255, ${(Math.random() * 0.05 + 0.02).toFixed(3)})`;
            context.fillRect(gx, gy, 1, 1);
        }

        // 3. 风格纹理
        context.strokeStyle = 'rgba(255, 255, 255, 0.035)';
        context.lineWidth = 1;
        const pat = theme.pattern || 'diagonal';
        if (pat === 'diagonal') {
            const diagStep = Math.max(7, canvasWidth * 0.045);
            for (let sx = -canvasHeight; sx < canvasWidth + canvasHeight; sx += diagStep) {
                context.beginPath();
                context.moveTo(sx, 0);
                context.lineTo(sx + canvasHeight, canvasHeight);
                context.stroke();
            }
        } else if (pat === 'huaxia') {
            const step = Math.max(14, canvasWidth * 0.06);
            context.strokeStyle = 'rgba(220, 180, 100, 0.10)';
            for (let x = step * 0.5; x < canvasWidth; x += step) {
                context.strokeRect(x, 4, step * 0.5, step * 0.5);
                context.strokeRect(x, canvasHeight - 4 - step * 0.5, step * 0.5, step * 0.5);
            }
        }

        // 4. 四角角标与装饰细线
        const cornerLen = Math.max(14, canvasWidth * 0.16);
        const cornerLw = Math.max(1.6, canvasWidth * 0.006);
        const m = 5;
        context.strokeStyle = theme.accent;
        context.lineWidth = cornerLw;
        context.lineCap = 'round';
        drawCornerBracket(context, m, m, 1, 1, cornerLen, cornerLw);
        drawCornerBracket(context, canvasWidth - m, m, -1, 1, cornerLen, cornerLw);
        drawCornerBracket(context, m, canvasHeight - m, 1, -1, cornerLen, cornerLw);
        drawCornerBracket(context, canvasWidth - m, canvasHeight - m, -1, -1, cornerLen, cornerLw);

        // 5. 正面文字绘制
        const textY = canvasHeight / 2 - ((mainContentLines.length - 1) * scaledLineHeight / 2);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.lineJoin = 'round';
        mainContentLines.forEach((line, index) => {
            const ty = textY + (index * scaledLineHeight);
            const textGrad = context.createLinearGradient(0, ty - scaledFontSize * 0.7, 0, ty + scaledFontSize * 0.7);
            textGrad.addColorStop(0, theme.textTop);
            textGrad.addColorStop(1, theme.textBot);
            context.fillStyle = textGrad;
            context.shadowColor = 'rgba(0, 0, 0, 0.9)';
            context.shadowBlur = scaledFontSize * 0.22;
            context.shadowOffsetY = scaledFontSize * 0.06;
            context.strokeStyle = 'rgba(0, 4, 12, 0.75)';
            context.lineWidth = scaledFontSize * 0.15;
            context.strokeText(line, canvasWidth / 2, ty);
            context.fillText(line, canvasWidth / 2, ty);
        });
        context.shadowBlur = 0;

        // 6. 边框发光线
        const borderGrad = context.createLinearGradient(0, 0, canvasWidth, 0);
        borderGrad.addColorStop(0, theme.borderA);
        borderGrad.addColorStop(0.5, theme.borderB);
        borderGrad.addColorStop(1, theme.borderA);
        context.strokeStyle = borderGrad;
        context.lineWidth = Math.max(1.8, 1.8 * textureResolutionScale * downScale);
        drawRoundedRect(context, 3, 3, canvasWidth - 6, canvasHeight - 6, 12 * textureResolutionScale * downScale);
        context.stroke();

        // 7. 发光蒙版 (Emissive Map) 填充
        ectx.fillStyle = 'rgb(0, 0, 0)';
        ectx.fillRect(0, 0, canvasWidth, canvasHeight);
        ectx.textAlign = 'center';
        ectx.textBaseline = 'middle';
        mainContentLines.forEach((line, index) => {
            const ty = textY + (index * scaledLineHeight);
            ectx.fillStyle = 'rgba(255, 255, 255, 0.92)';
            ectx.fillText(line, canvasWidth / 2, ty);
        });
        ectx.strokeStyle = theme.emBorder;
        ectx.lineWidth = Math.max(1.6, 1.6 * textureResolutionScale * downScale);
        drawRoundedRect(ectx, 3, 3, canvasWidth - 6, canvasHeight - 6, 12 * textureResolutionScale * downScale);
        ectx.stroke();
        ectx.strokeStyle = theme.emBracket;
        ectx.lineWidth = cornerLw;
        drawCornerBracket(ectx, m, m, 1, 1, cornerLen, cornerLw);
        drawCornerBracket(ectx, canvasWidth - m, m, -1, 1, cornerLen, cornerLw);
        drawCornerBracket(ectx, m, canvasHeight - m, 1, -1, cornerLen, cornerLw);
        drawCornerBracket(ectx, canvasWidth - m, canvasHeight - m, -1, -1, cornerLen, cornerLw);

        // 放入缓存池
        _cardCanvasCache.set(cacheKey, { base: canvas, emissive: emissiveCanvas });
        if (_cardCanvasCache.size > CARD_CANVAS_CACHE_MAX) {
            const oldest = _cardCanvasCache.keys().next().value;
            _cardCanvasCache.delete(oldest);
        }

        const tex = finalizeCanvasTexture(canvas, 8);
        const emissiveTex = finalizeCanvasTexture(emissiveCanvas, 8);

        return {
            texture: tex,
            emissiveTexture: emissiveTex,
            pxWidth: canvasWidth,
            pxHeight: canvasHeight,
            resolutionScale: textureResolutionScale
        };
    },

    createIceCard(word) {
        const texData = this.createCardTexture(word);
        const pxH = texData.pxHeight || 92;
        const pxW = texData.pxWidth || 200;
        const aspect = pxH > 0 ? pxW / pxH : 2.0;

        const sphereRadius = appState.sphereRadius || 100;
        const width = Math.max(0.1, sphereRadius * 0.12);
        const height = Math.max(0.1, width / aspect);
        const depth = Math.max(0.01, width * 0.04);

        const geoKey = aspect.toFixed(2) + '|' + sphereRadius.toFixed(1);
        let geometry = _cardGeoCache.get(geoKey);

        if (!geometry) {
            const shape = new THREE.Shape();
            const x = -width / 2, y = -height / 2;
            const radius = width * 0.08;
            const w = width, h = height;

            shape.moveTo(x + radius, y);
            shape.lineTo(x + w - radius, y);
            shape.quadraticCurveTo(x + w, y, x + w, y + radius);
            shape.lineTo(x + w, y + h - radius);
            shape.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            shape.lineTo(x + radius, y + h);
            shape.quadraticCurveTo(x, y + h, x, y + h - radius);
            shape.lineTo(x, y + radius);
            shape.quadraticCurveTo(x, y, x + radius, y);

            const bevelThickness = width * 0.012;
            const bevelSize = width * 0.008;

            const extrudeSettings = {
                steps: 1,
                depth: Math.max(0.001, depth - bevelThickness * 2),
                bevelEnabled: true,
                bevelThickness: bevelThickness,
                bevelSize: bevelSize,
                bevelOffset: -bevelSize,
                bevelSegments: 4,
                curveSegments: 16
            };

            try {
                geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                geometry.center();
            } catch (e) {
                geometry = new THREE.BoxGeometry(width, height, depth);
            }
            _cardGeoCache.set(geoKey, geometry);
        }

        const cardSideStyle = APP_CONFIG.CARD_STYLES.find(s => s.id === appState.currentCardStyleId) || APP_CONFIG.CARD_STYLES[0];

        const frontMat = new THREE.MeshStandardMaterial({
            map: texData.texture,
            emissive: 0xffffff,
            emissiveMap: texData.emissiveTexture,
            emissiveIntensity: 0.72,
            roughness: 0.92,
            metalness: 0.0,
            transparent: true,
            opacity: 0.95,
            side: THREE.FrontSide
        });

        const sideMat = new THREE.MeshStandardMaterial({
            color: cardSideStyle.sideColor,
            roughness: 0.85,
            metalness: 0.0,
            transparent: true,
            opacity: 0.4,
            emissive: new THREE.Color(cardSideStyle.sideEmissive),
            emissiveIntensity: 0.45,
            side: THREE.DoubleSide
        });

        const materials = [frontMat, sideMat];
        const card = new THREE.Mesh(geometry, materials);

        card.userData = {
            word: word,
            originalMaterials: materials,
            hoverSideMaterial: sideMat.clone(),
            rotationAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
            rotationSpeed: 0.3 + Math.random() * 0.7
        };

        return card;
    },

    createOverlayTexture(word) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const fontFamily = "'Segoe UI', 'Roboto', 'Microsoft YaHei', sans-serif";

        const mainWordColor = document.getElementById('hoverCardTextMainWordColor')?.value || '#FFFFFF';
        const valueColor = document.getElementById('hoverCardTextValueColor')?.value || '#FFFFFF';
        const labelColor = document.getElementById('hoverCardTextLabelColor')?.value || '#8CFEFF';
        const textGlowColor = document.getElementById('hoverCardTextGlowColor')?.value || '#00FFFF';
        const textGlowIntensity = parseFloat(document.getElementById('hoverCardTextGlowIntensity')?.value || '0.5');

        const dpr = window.devicePixelRatio || 1;
        const scale = IS_MOBILE_DEVICE ? Math.min(dpr, 1.8) : 1.0;
        const canvasWidth = Math.round(1200 * scale);
        const baseSize = 1200 * 0.038 * scale;
        const paddingX = 60 * scale;
        const paddingY = 45 * scale;
        const wrapWidth = canvasWidth - paddingX * 2;

        const englishWord = (word.words || 'N/A').trim();
        const phoneticSymbol = word.phonetic || '';
        const chineseMeaning = word.chinese || '无释义';
        const memoryMethod = word.method || '暂无联想记忆提示';

        const cacheKey = [englishWord, phoneticSymbol, chineseMeaning, memoryMethod, mainWordColor, valueColor, labelColor, textGlowColor, textGlowIntensity, scale].join('\u0001');
        const cached = _overlayCanvasCache.get(cacheKey);
        if (cached) {
            word.hover_click_zones = cached.zones.map(z => ({ ...z }));
            const tex = finalizeCanvasTexture(cached.canvas, 4);
            return { texture: tex, pxWidth: cached.canvas.width, pxHeight: cached.canvas.height };
        }

        const testCtx = getSharedTestContext();
        function wrapText(text, font, maxWidth) {
            testCtx.font = font;
            const lines = [];
            let currentLine = '';
            for (let char of text.split('')) {
                let testLine = currentLine + char;
                if (testCtx.measureText(testLine).width > maxWidth && currentLine) {
                    lines.push(currentLine);
                    currentLine = char;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) lines.push(currentLine);
            return lines;
        }

        const fontMain = `bold ${Math.round(baseSize * 1.55)}px ${fontFamily}`;
        const fontPhonetic = `${Math.round(baseSize * 0.95)}px ${fontFamily}`;
        const fontMeaning = `bold ${Math.round(baseSize * 1.25)}px ${fontFamily}`;
        const fontTitle = `bold ${Math.round(baseSize * 1.05)}px ${fontFamily}`;
        const fontMethod = `${Math.round(baseSize * 1.10)}px ${fontFamily}`;
        const fontButton = `bold ${Math.round(baseSize * 0.76)}px ${fontFamily}`;

        const meaningLines = wrapText(chineseMeaning, fontMeaning, wrapWidth);
        const methodLines = wrapText(memoryMethod, fontMethod, wrapWidth);

        let currentY = paddingY + baseSize * 1.8 + meaningLines.length * (baseSize * 1.5) + baseSize * 2.3 + methodLines.length * (baseSize * 1.3) + paddingY;
        const canvasHeight = Math.round(currentY);
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        context.clearRect(0, 0, canvasWidth, canvasHeight);
        context.shadowColor = textGlowColor;
        context.shadowBlur = textGlowIntensity * 20 * scale;
        context.textBaseline = 'top';

        // 英文主单词与音标
        context.textAlign = 'left';
        context.font = fontMain;
        context.fillStyle = mainWordColor;
        context.fillText(englishWord, paddingX, paddingY);

        testCtx.font = fontMain;
        const wordWidth = testCtx.measureText(englishWord).width;
        context.font = fontPhonetic;
        context.fillStyle = labelColor;
        context.fillText(phoneticSymbol, paddingX + wordWidth + 25 * scale, paddingY + (baseSize * 0.35));

        // 按钮组（发音、A-、A+、屏蔽）
        const btnHeight = baseSize * 1.05;
        const spacing = 10 * scale;
        const btnY = paddingY + (baseSize * 1.55 - btnHeight) / 2;
        const btnWidthSpeaker = baseSize * 1.3;
        const btnWidthA = baseSize * 1.15;
        const btnWidthShield = baseSize * 1.8;

        const btnShieldX = canvasWidth - paddingX - btnWidthShield;
        const btnPlusX = btnShieldX - spacing - btnWidthA;
        const btnMinusX = btnPlusX - spacing - btnWidthA;
        const btnSpeakerX = btnMinusX - spacing - btnWidthSpeaker;

        word.hover_click_zones = [];

        function drawPillButton(label, x, y, w, h, isDanger = false) {
            context.save();
            context.fillStyle = isDanger ? 'rgba(239, 68, 68, 0.18)' : 'rgba(0, 240, 255, 0.08)';
            context.strokeStyle = isDanger ? 'rgba(239, 68, 68, 0.6)' : 'rgba(0, 240, 255, 0.4)';
            context.lineWidth = Math.max(1.0, 1.4 * scale);
            context.beginPath();
            const r = h / 2;
            context.moveTo(x + r, y);
            context.lineTo(x + w - r, y);
            context.quadraticCurveTo(x + w, y, x + w, y + r);
            context.lineTo(x + w, y + h - r);
            context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            context.lineTo(x + r, y + h);
            context.quadraticCurveTo(x, y + h, x, y + h - r);
            context.lineTo(x, y + r);
            context.quadraticCurveTo(x, y, x + r, y);
            context.closePath();
            context.fill();
            context.stroke();

            context.font = fontButton;
            context.fillStyle = isDanger ? '#ff9a9a' : 'rgba(180, 230, 255, 0.95)';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(label, x + w / 2, y + h / 2);
            context.restore();
        }

        const padY = Math.max(16, 20 * scale);
        const padX = Math.max(8, 12 * scale);

        drawPillButton('🔊', btnSpeakerX, btnY, btnWidthSpeaker, btnHeight);
        word.hover_click_zones.push({
            type: 'speak',
            xMin: btnSpeakerX - padX, xMax: btnSpeakerX + btnWidthSpeaker + padX,
            yMin: Math.max(0, btnY - padY), yMax: btnY + btnHeight + padY
        });

        drawPillButton('A-', btnMinusX, btnY, btnWidthA, btnHeight);
        word.hover_click_zones.push({
            type: 'fontSizeDown',
            xMin: btnMinusX - padX, xMax: btnMinusX + btnWidthA + padX,
            yMin: Math.max(0, btnY - padY), yMax: btnY + btnHeight + padY
        });

        drawPillButton('A+', btnPlusX, btnY, btnWidthA, btnHeight);
        word.hover_click_zones.push({
            type: 'fontSizeUp',
            xMin: btnPlusX - padX, xMax: btnPlusX + btnWidthA + padX,
            yMin: Math.max(0, btnY - padY), yMax: btnY + btnHeight + padY
        });

        drawPillButton('🛡️ 屏蔽', btnShieldX, btnY, btnWidthShield, btnHeight, true);
        word.hover_click_zones.push({
            type: 'shield',
            xMin: btnShieldX - padX, xMax: btnShieldX + btnWidthShield + padX,
            yMin: Math.max(0, btnY - padY), yMax: btnY + btnHeight + padY
        });

        word.hover_click_zones.push({
            type: 'word',
            xMin: paddingX, xMax: btnSpeakerX - padX,
            yMin: Math.max(0, paddingY - 10 * scale), yMax: paddingY + baseSize * 1.8
        });

        // 释义内容
        let writeY = paddingY + baseSize * 1.8;
        context.font = fontMeaning;
        context.fillStyle = valueColor;
        meaningLines.forEach(line => {
            context.fillText(line, paddingX, writeY);
            writeY += baseSize * 1.5;
        });

        writeY += baseSize * 0.4;
        context.strokeStyle = 'rgba(104, 240, 255, 0.25)';
        context.lineWidth = Math.max(1, Math.round(1 * scale));
        context.beginPath();
        context.moveTo(paddingX, writeY);
        context.lineTo(canvasWidth - paddingX, writeY);
        context.stroke();

        writeY += baseSize * 0.6;
        context.font = fontTitle;
        context.fillStyle = '#FFD700';
        context.fillText('💡 记忆方法 / Memory Association', paddingX, writeY);

        writeY += baseSize * 1.3;
        context.font = fontMethod;
        context.fillStyle = 'rgba(255, 255, 192, 0.95)';
        methodLines.forEach(line => {
            context.fillText(line, paddingX, writeY);
            writeY += baseSize * 1.3;
        });

        if (_overlayCanvasCache.size >= OVERLAY_CANVAS_CACHE_MAX) {
            _overlayCanvasCache.delete(_overlayCanvasCache.keys().next().value);
        }
        _overlayCanvasCache.set(cacheKey, { canvas, zones: [...word.hover_click_zones] });

        const tex = finalizeCanvasTexture(canvas, 4);
        return { texture: tex, pxWidth: canvasWidth, pxHeight: canvasHeight };
    },

    updateCardWordData(card, newWord) {
        if (!card || !newWord) return;
        card.userData.word = newWord;
        const texData = this.createCardTexture(newWord);
        if (card.userData.frontMaterial && card.userData.frontMaterial.map) {
            card.userData.frontMaterial.map.dispose();
            card.userData.frontMaterial.map = texData.texture;
            if (card.userData.frontMaterial.emissiveMap) {
                card.userData.frontMaterial.emissiveMap.dispose();
                card.userData.frontMaterial.emissiveMap = texData.emissiveTexture;
            }
            card.userData.frontMaterial.needsUpdate = true;
        } else if (Array.isArray(card.material) && card.material[0] && card.material[0].map) {
            card.material[0].map.dispose();
            card.material[0].map = texData.texture;
            if (card.material[0].emissiveMap) {
                card.material[0].emissiveMap.dispose();
                card.material[0].emissiveMap = texData.emissiveTexture;
            }
            card.material[0].needsUpdate = true;
        }
    }
};

window.AppCardFactory = AppCardFactory;
window.disposeObject = disposeObject;