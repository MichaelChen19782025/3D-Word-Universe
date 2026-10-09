/**
 * 3D单词宇宙 - 卡片工坊 (Card Factory)
 * 支持右上角 5 大功能键：[🔊] [A-] [A+] [📝 备注] [屏蔽]
 */
(function() {
    let _sharedTestCanvas = null;
    let _sharedTestCtx = null;

    function getSharedTestContext() {
        if (!_sharedTestCanvas) {
            _sharedTestCanvas = document.createElement('canvas');
            _sharedTestCtx = _sharedTestCanvas.getContext('2d');
        }
        return _sharedTestCtx;
    }

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
        updateCardsMaterialsFast(options = {}) {
            if (!appState.wordObjects || appState.wordObjects.length === 0) return;
            const targetOpacity = options.opacity !== undefined ? options.opacity : parseFloat(document.getElementById('cardOpacityRange')?.value || '0.96');
            const targetLightColor = options.lightColor || document.getElementById('cardLightColor')?.value || '#00f0ff';
            const rawLightBrightness = options.lightBrightness !== undefined ? options.lightBrightness : parseFloat(document.getElementById('cardLightBrightnessRange')?.value || '0.85');
            const sideEmissiveIntensity = Math.max(0, rawLightBrightness * 0.35);

            const sideColor = new THREE.Color(targetLightColor);

            for (let i = 0; i < appState.wordObjects.length; i++) {
                const card = appState.wordObjects[i];
                if (Array.isArray(card.material)) {
                    if (card.material[0]) {
                        card.material[0].opacity = targetOpacity;
                        card.material[0].visible = (targetOpacity > 0.001);
                    }
                    if (card.material[1]) {
                        card.material[1].opacity = targetOpacity * 0.45;
                        card.material[1].emissive.copy(sideColor);
                        card.material[1].emissiveIntensity = sideEmissiveIntensity;
                        card.material[1].visible = (targetOpacity > 0.001);
                    }
                } else if (card.material) {
                    card.material.opacity = targetOpacity;
                    card.material.visible = (targetOpacity > 0.001);
                }
            }
            appState.needsRender = true;
        },

        createCardTexture(word) {
            const baseFontSize = APP_CONFIG.DEFAULT_SPHERE_CARD_FONT_SIZE;
            const dpr = window.devicePixelRatio || 1;
            let textureResolutionScale = IS_MOBILE_DEVICE ? Math.min(dpr, 1.8) : 1.25;

            let fontFactor = appState.currentSphereCardFontSizeFactor || 1.0;
            const rawFontSize = Math.round(baseFontSize * fontFactor * textureResolutionScale);
            const fontFamily = document.getElementById('sphereCardFontFamily')?.value || "'Microsoft YaHei', sans-serif";

            const currentPresetId = document.getElementById('cardStylePresetSelect')?.value || 'cyber_blue';
            const preset = window.CardStyleManager ? window.CardStyleManager.getPreset(currentPresetId) : {};

            const customLightColor = document.getElementById('cardLightColor')?.value || preset.defaultLightColor || '#00f0ff';
            const customLightPos = document.getElementById('cardLightPositionSelect')?.value || preset.defaultLightPosition || 'center';
            const customLightBrightness = parseFloat(document.getElementById('cardLightBrightnessRange')?.value ?? (preset.defaultLightBrightness ?? 0.85));
            const customLightSpread = parseFloat(document.getElementById('cardLightSpreadRange')?.value ?? (preset.defaultLightSpread ?? 0.85));
            const customDepth = parseFloat(document.getElementById('cardChamberDepthRange')?.value ?? 0.65);
            const customTextStyle = preset.textStyle || 'relief_metal';
            const customFontColor = preset.textColor || '#ffffff';

            const displayWordRaw = appState.showEnglish ? (word.words || 'N/A') : ((word.chinese || '').split(/,|，/)[0] || 'N/A');

            const testContext = getSharedTestContext();
            testContext.font = `bold ${rawFontSize}px ${fontFamily}`;

            let mainContentLines = [];
            if (appState.showEnglish) {
                const words = displayWordRaw.split(' ');
                let currentLine = "";
                for (let wd of words) {
                    if (testContext.measureText(currentLine + (currentLine ? " " : "") + wd).width > (rawFontSize * APP_CONFIG.MAX_CHARS_PER_LINE_EN * 0.78) && currentLine) {
                        mainContentLines.push(currentLine);
                        currentLine = wd;
                    } else {
                        currentLine += (currentLine ? " " : "") + wd;
                    }
                }
                if (currentLine) mainContentLines.push(currentLine);
            } else {
                let currentLine = "";
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
            let padding = rawFontSize * 1.35;
            let lineHeight = rawFontSize * 1.35;
            let canvasWidth = Math.max(240 * textureResolutionScale, mainTextWidth + padding * 3.6);
            const mainTextHeight = mainContentLines.length * lineHeight;
            let canvasHeight = Math.max(115 * textureResolutionScale, mainTextHeight + padding * 2.4);

            const MAX_TEXTURE_SIZE = IS_MOBILE_DEVICE ? 512 : 1024;
            const downScale = Math.min(1, MAX_TEXTURE_SIZE / Math.max(canvasWidth, canvasHeight));
            canvasWidth = Math.round(canvasWidth * downScale) || 240;
            canvasHeight = Math.round(canvasHeight * downScale) || 115;

            const scaledFontSize = Math.round(rawFontSize * downScale);
            const scaledLineHeight = lineHeight * downScale;

            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const context = canvas.getContext('2d');
            context.font = `bold ${scaledFontSize}px ${fontFamily}`;

            if (window.CardStyleManager) {
                const chamberCfg = {
                    ...preset,
                    depthFactor: customDepth,
                    lightColor: customLightColor,
                    lightPosition: customLightPos,
                    lightBrightness: customLightBrightness,
                    lightSpread: customLightSpread
                };
                window.CardStyleManager.drawPerspectiveChamber(context, canvasWidth, canvasHeight, chamberCfg);
            } else {
                context.fillStyle = '#06122a';
                context.fillRect(0, 0, canvasWidth, canvasHeight);
            }

            const textY = canvasHeight / 2 - ((mainContentLines.length - 1) * scaledLineHeight / 2);
            mainContentLines.forEach((line, index) => {
                const curY = textY + (index * scaledLineHeight);
                if (window.CardStyleManager) {
                    window.CardStyleManager.draw3DText(context, line, canvasWidth / 2, curY, {
                        fontSize: scaledFontSize,
                        textColor: customFontColor,
                        textStyle: customTextStyle,
                        textDepthColor: preset.textDepthColor || '#070a12',
                        textHighlightColor: preset.textHighlightColor || '#b5f5ff',
                        lightPosition: customLightPos,
                        lightColor: customLightColor,
                        lightBrightness: customLightBrightness
                    });
                } else {
                    context.fillStyle = customFontColor;
                    context.textAlign = 'center';
                    context.textBaseline = 'middle';
                    context.fillText(line, canvasWidth / 2, curY);
                }
            });

            return {
                texture: finalizeCanvasTexture(canvas, 8),
                pxWidth: canvasWidth,
                pxHeight: canvasHeight,
                lightBrightness: customLightBrightness,
                lightColor: customLightColor
            };
        },

        createIceCard(word) {
            const texData = this.createCardTexture(word);
            const pxH = texData.pxHeight || 115;
            const pxW = texData.pxWidth || 240;
            const aspect = pxH > 0 ? pxW / pxH : 2.0;

            const sphereRadius = appState.sphereRadius || 85;
            const width = sphereRadius * 0.125;
            const height = width / aspect;
            const depth = width * 0.045;

            const shape = new THREE.Shape();
            const x = -width / 2, y = -height / 2;
            const radius = width * 0.085;
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
                steps: 1, depth: depth - bevelThickness * 2,
                bevelEnabled: true, bevelThickness: bevelThickness,
                bevelSize: bevelSize, bevelOffset: -bevelSize,
                bevelSegments: 4, curveSegments: 16
            };

            let geometry;
            try {
                geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                geometry.center();
            } catch (e) {
                geometry = new THREE.BoxGeometry(width, height, depth);
            }

            const cardOpacity = parseFloat(document.getElementById('cardOpacityRange')?.value || '0.96');

            const frontMat = new THREE.MeshStandardMaterial({
                map: texData.texture, roughness: 0.85, metalness: 0.15,
                transparent: true, opacity: cardOpacity, visible: (cardOpacity > 0.001),
                side: THREE.FrontSide
            });

            const sideEmissiveColor = new THREE.Color(texData.lightColor || 0x00bfff);
            const sideEmissiveIntensity = Math.max(0, texData.lightBrightness * 0.35);

            const sideMat = new THREE.MeshStandardMaterial({
                color: 0x0a162b, roughness: 0.85, metalness: 0.25,
                transparent: true, opacity: cardOpacity * 0.45, visible: (cardOpacity > 0.001),
                emissive: sideEmissiveColor, emissiveIntensity: sideEmissiveIntensity,
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

        createCornerBrackets() {
            const bracketGroup = new THREE.Group();
            const bracketCanvas = document.createElement('canvas');
            bracketCanvas.width = 64; bracketCanvas.height = 64;
            const ctx = bracketCanvas.getContext('2d');
            ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(6, 34); ctx.lineTo(6, 6); ctx.lineTo(34, 6); ctx.stroke();
            const bracketTexture = new THREE.CanvasTexture(bracketCanvas);

            const bracketMat = new THREE.MeshBasicMaterial({
                map: bracketTexture, color: 0x00ffff, transparent: true, opacity: 0.9,
                blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
            });

            const size = 0.24;
            const bracketGeo = new THREE.PlaneGeometry(size, size);

            for (let i = 0; i < 4; i++) {
                const bracket = new THREE.Mesh(bracketGeo, bracketMat.clone());
                const signX = (i % 2 === 0) ? -1 : 1;
                const signY = (i < 2) ? 1 : -1;
                bracket.position.set(signX * 0.5, signY * 0.5, 0.01);

                let rotation = 0;
                if (signX === 1 && signY === 1) rotation = -Math.PI / 2;
                else if (signX === -1 && signY === -1) rotation = Math.PI / 2;
                else if (signX === 1 && signY === -1) rotation = Math.PI;
                bracket.rotation.z = rotation;
                bracketGroup.add(bracket);
            }
            return bracketGroup;
        },

        /**
         * 3D 浮动查词卡纹理生成：右上角配置 5 个按钮 [🔊] [A-] [A+] [📝 备注] [屏蔽]
         */
        createOverlayTexture(word) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const fontFamily = "'Segoe UI', 'Roboto', 'Microsoft YaHei', sans-serif";

            const rawBrightness = parseFloat(document.getElementById('hoverCardBrightness')?.value || '1.0');
            const isPitchBlack = (rawBrightness <= 0.001);

            const dpr = window.devicePixelRatio || 1;
            const scale = IS_MOBILE_DEVICE ? Math.min(dpr, 1.8) : 1.0;
            const canvasWidth = Math.round(1240 * scale);
            const baseSize = 1240 * 0.038 * scale;

            const paddingX = Math.round(68 * scale);
            const paddingY = Math.round(48 * scale);
            const wrapWidth = canvasWidth - paddingX * 2;

            const englishWord = (word.words || 'N/A').trim();
            const phoneticSymbol = word.phonetic ? `/${word.phonetic.replace(/^\/+|\/+$/g, '')}/` : '';
            const chineseMeaning = word.chinese || '无释义';
            const memoryMethod = word.method || '暂无联想记忆提示';
            const notesCount = (Array.isArray(word.notes) ? word.notes.length : 0);

            const testCtx = getSharedTestContext();
            function wrapText(text, font, maxWidth) {
                testCtx.font = font;
                const lines = [];
                let currentLine = "";
                for (let char of text.split("")) {
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
            const fontMethod = `bold ${Math.round(baseSize * 1.15)}px ${fontFamily}`;
            const fontButton = `bold ${Math.round(baseSize * 0.72)}px ${fontFamily}`;

            const meaningLines = wrapText(chineseMeaning, fontMeaning, wrapWidth);
            const methodLines = wrapText(memoryMethod, fontMethod, wrapWidth);

            let currentY = paddingY;
            const mainWordHeight = baseSize * 1.8;
            currentY += mainWordHeight;

            const meaningLineHeight = baseSize * 1.5;
            currentY += meaningLines.length * meaningLineHeight + baseSize * 0.4;
            currentY += baseSize * 0.6; // 分割线
            currentY += baseSize * 1.3; // 记忆法标题

            const methodLineHeight = baseSize * 1.35;
            currentY += methodLines.length * methodLineHeight + paddingY;

            const canvasHeight = Math.round(currentY);
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            if (isPitchBlack) {
                context.fillStyle = '#000000';
                context.fillRect(0, 0, canvasWidth, canvasHeight);
            } else {
                context.clearRect(0, 0, canvasWidth, canvasHeight);
            }

            context.textBaseline = 'top';

            // 1. 主英文单词
            context.textAlign = "left";
            context.font = fontMain;
            context.fillStyle = "#ffffff";
            context.save();
            context.shadowColor = "rgba(0, 240, 255, 0.95)";
            context.shadowBlur = 18 * scale;
            context.fillText(englishWord, paddingX, paddingY);
            context.restore();

            testCtx.font = fontMain;
            const wordWidth = testCtx.measureText(englishWord).width;

            // 音标
            context.font = fontPhonetic;
            context.fillStyle = "#A0FFEE";
            context.save();
            context.shadowColor = "rgba(0, 240, 255, 0.6)";
            context.shadowBlur = 8 * scale;
            context.fillText(phoneticSymbol, paddingX + wordWidth + 24 * scale, paddingY + (baseSize * 0.40));
            context.restore();

            // 2. 右侧 5 大胶囊按钮：[🔊] [A-] [A+] [📝 备注] [屏蔽]
            const btnHeight = baseSize * 0.95;
            const spacing = 8 * scale;
            const btnY = paddingY + (baseSize * 1.55 - btnHeight) / 2;

            const btnWidthSpeaker = baseSize * 1.2;
            const btnWidthA = baseSize * 1.05;
            const btnWidthNote = notesCount > 0 ? (baseSize * 1.8) : (baseSize * 1.35);
            const btnWidthShield = baseSize * 1.5;

            const btnShieldX = canvasWidth - paddingX - btnWidthShield;
            const btnNoteX = btnShieldX - spacing - btnWidthNote;
            const btnPlusX = btnNoteX - spacing - btnWidthA;
            const btnMinusX = btnPlusX - spacing - btnWidthA;
            const btnSpeakerX = btnMinusX - spacing - btnWidthSpeaker;

            const zones = [];

            function drawPillButton(label, x, y, w, h, variant = 'normal') {
                context.save();
                if (variant === 'shield') {
                    context.fillStyle = "rgba(220, 38, 38, 0.18)";
                    context.strokeStyle = "rgba(255, 120, 120, 0.65)";
                } else if (variant === 'note') {
                    context.fillStyle = "rgba(255, 216, 117, 0.22)";
                    context.strokeStyle = "rgba(255, 216, 117, 0.75)";
                } else {
                    context.fillStyle = "rgba(0, 240, 255, 0.08)";
                    context.strokeStyle = "rgba(0, 240, 255, 0.45)";
                }
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
                context.fillStyle = (variant === 'shield') ? "#ffb3b3" : (variant === 'note' ? "#ffd875" : "rgba(180, 230, 255, 0.95)");
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.shadowColor = "rgba(0, 0, 0, 0.8)";
                context.shadowBlur = 4;
                context.fillText(label, x + w / 2, y + h / 2);
                context.restore();
            }

            // [🔊]
            drawPillButton("🔊", btnSpeakerX, btnY, btnWidthSpeaker, btnHeight, 'normal');
            zones.push({ type: 'speak', xMin: btnSpeakerX - 6, xMax: btnSpeakerX + btnWidthSpeaker + 6, yMin: btnY - 6, yMax: btnY + btnHeight + 6 });

            // [A-]
            drawPillButton("A-", btnMinusX, btnY, btnWidthA, btnHeight, 'normal');
            zones.push({ type: 'fontSizeDown', xMin: btnMinusX - 6, xMax: btnMinusX + btnWidthA + 6, yMin: btnY - 6, yMax: btnY + btnHeight + 6 });

            // [A+]
            drawPillButton("A+", btnPlusX, btnY, btnWidthA, btnHeight, 'normal');
            zones.push({ type: 'fontSizeUp', xMin: btnPlusX - 6, xMax: btnPlusX + btnWidthA + 6, yMin: btnY - 6, yMax: btnY + btnHeight + 6 });

            // [📝 备注] (带数量显示)
            const noteLabel = notesCount > 0 ? `📝${notesCount}` : "📝";
            drawPillButton(noteLabel, btnNoteX, btnY, btnWidthNote, btnHeight, 'note');
            zones.push({ type: 'note', xMin: btnNoteX - 6, xMax: btnNoteX + btnWidthNote + 6, yMin: btnY - 6, yMax: btnY + btnHeight + 6 });

            // [屏蔽]
            drawPillButton("屏蔽", btnShieldX, btnY, btnWidthShield, btnHeight, 'shield');
            zones.push({ type: 'shield', xMin: btnShieldX - 6, xMax: btnShieldX + btnWidthShield + 6, yMin: btnY - 6, yMax: btnY + btnHeight + 6 });

            // 主单词发音区域
            zones.push({ type: 'speak', xMin: paddingX - 10, xMax: btnSpeakerX - spacing, yMin: paddingY - 10, yMax: paddingY + mainWordHeight + 10 });

            // 3. 中文释义
            let writeY = paddingY + mainWordHeight;
            context.font = fontMeaning;
            context.fillStyle = "#ffffff";
            context.save();
            context.shadowColor = "rgba(0, 240, 255, 0.7)";
            context.shadowBlur = 12 * scale;
            meaningLines.forEach(line => {
                context.fillText(line, paddingX, writeY);
                writeY += meaningLineHeight;
            });
            context.restore();

            // 4. 分割线
            writeY += baseSize * 0.4;
            context.strokeStyle = "rgba(104, 240, 255, 0.28)";
            context.lineWidth = Math.max(1, Math.round(1 * scale));
            context.beginPath();
            context.moveTo(paddingX, writeY);
            context.lineTo(canvasWidth - paddingX, writeY);
            context.stroke();

            // 5. 记忆方法标题
            writeY += baseSize * 0.6;
            context.font = fontTitle;
            context.fillStyle = "#FFE600";
            context.save();
            context.shadowColor = "rgba(255, 230, 0, 0.9)";
            context.shadowBlur = 14 * scale;
            context.fillText("💡 记忆方法 / Memory Association", paddingX, writeY);
            context.restore();

            // 6. 记忆方法正文
            writeY += baseSize * 1.35;
            context.font = fontMethod;
            context.fillStyle = "#A0FFEE";
            context.save();
            context.shadowColor = "rgba(0, 240, 255, 0.65)";
            context.shadowBlur = 8 * scale;
            methodLines.forEach(line => {
                context.fillText(line, paddingX, writeY);
                writeY += methodLineHeight;
            });
            context.restore();

            zones.push({ type: 'card_body', xMin: 0, xMax: canvasWidth, yMin: 0, yMax: canvasHeight });

            word.hover_click_zones = zones;
            if (appState.hoverOverlayCard) {
                appState.hoverOverlayCard.userData.hover_click_zones = zones;
            }

            return {
                texture: finalizeCanvasTexture(canvas, 8),
                pxWidth: canvasWidth,
                pxHeight: canvasHeight
            };
        }
    };

    window.AppCardFactory = AppCardFactory;
    window.disposeObject = disposeObject;
})();