/**
 * 3D单词宇宙 - 卡片工坊 (Card Factory)
 * 1. 核心修复：注入精准全覆盖 UVGenerator，让底色、内腔、发光与文字100%平铺填满卡片全表面
 * 2. 侧边厚度与倒角材质全面联动底色与泛光色彩，营造物理立体微电子展板质感
 * 3. 悬浮查词卡边距极窄化（仅保留约2px缓冲），横向空间最大化利用
 * 4. 装饰拐角贴合收敛，计算屏幕限制时彻底忽略外延
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
            const targetBrightness = options.brightness !== undefined ? options.brightness : parseFloat(document.getElementById('sphereCardBrightnessRange')?.value || '0.50');
            const targetExposure = options.exposure !== undefined ? options.exposure : parseFloat(document.getElementById('cardExposureRange')?.value || '0.35');

            for (let i = 0; i < appState.wordObjects.length; i++) {
                const card = appState.wordObjects[i];
                if (Array.isArray(card.material)) {
                    if (card.material[0]) {
                        card.material[0].opacity = targetOpacity;
                        card.material[0].emissiveIntensity = targetBrightness;
                        card.material[0].color.setRGB(targetExposure, targetExposure, targetExposure);
                        card.material[0].transparent = true;
                        card.material[0].visible = (targetOpacity > 0.001);
                        card.material[0].needsUpdate = true;
                    }
                    if (card.material[1]) {
                        card.material[1].opacity = targetOpacity * 0.75;
                        card.material[1].visible = (targetOpacity > 0.001);
                        card.material[1].needsUpdate = true;
                    }
                } else if (card.material) {
                    card.material.opacity = targetOpacity;
                    card.material.emissiveIntensity = targetBrightness;
                    card.material.color.setRGB(targetExposure, targetExposure, targetExposure);
                    card.material.transparent = true;
                    card.material.visible = (targetOpacity > 0.001);
                    card.material.needsUpdate = true;
                }
            }
            appState.needsRender = true;
        },

        createCardTexture(word) {
            const baseFontSize = parseFloat(document.getElementById('sphereCardFontSize')?.value || '36');
            const dpr = window.devicePixelRatio || 1;
            let textureResolutionScale = IS_MOBILE_DEVICE ? Math.min(dpr, 1.8) : 1.35;

            const rawFontSize = Math.round(baseFontSize * textureResolutionScale);
            const fontFamily = document.getElementById('sphereCardFontFamily')?.value || "'Microsoft YaHei', sans-serif";

            const currentPresetId = document.getElementById('cardStylePresetSelect')?.value || 'cyber_blue';
            const preset = window.CardStyleManager ? window.CardStyleManager.getPreset(currentPresetId) : {};

            const customLightColor = document.getElementById('cardLightColor')?.value || preset.defaultLightColor || '#00f0ff';
            const customLightPos = document.getElementById('cardLightPositionSelect')?.value || preset.defaultLightPosition || 'center';
            const customLightBrightness = parseFloat(document.getElementById('cardLightBrightnessRange')?.value ?? (preset.defaultLightBrightness ?? 0.85));
            const customLightSpread = parseFloat(document.getElementById('cardLightSpreadRange')?.value ?? (preset.defaultLightSpread ?? 0.85));
            const customDepth = parseFloat(document.getElementById('cardChamberDepthRange')?.value ?? 0.65);
            const customTextStyle = document.getElementById('cardTextStyleSelect')?.value || 'plain_bold';
            const customFontColor = document.getElementById('sphereCardFontColor')?.value || '#ffffff';
            const customBaseColor = document.getElementById('cardBaseColor')?.value || '#06122a';

            const displayWordRaw = appState.showEnglish ? (word.words || 'N/A') : ((word.chinese || '').split(/,|，/)[0] || 'N/A');

            const testContext = getSharedTestContext();
            testContext.font = `bold ${rawFontSize}px ${fontFamily}`;

            let mainContentLines = [];
            if (appState.showEnglish) {
                const words = displayWordRaw.split(' ');
                let currentLine = "";
                for (let wd of words) {
                    if (testContext.measureText(currentLine + (currentLine ? " " : "") + wd).width > (rawFontSize * APP_CONFIG.MAX_CHARS_PER_LINE_EN * 0.82) && currentLine) {
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
                    if (testContext.measureText(currentLine + char).width > (rawFontSize * APP_CONFIG.MAX_CHARS_PER_LINE_CN * 1.15) && currentLine) {
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
            let paddingX = rawFontSize * 1.15;
            let paddingY = rawFontSize * 0.85;
            let lineHeight = rawFontSize * 1.25;

            let canvasWidth = Math.max(260 * textureResolutionScale, mainTextWidth + paddingX * 2);
            const mainTextHeight = mainContentLines.length * lineHeight;
            let canvasHeight = Math.max(130 * textureResolutionScale, mainTextHeight + paddingY * 2);

            const MAX_TEXTURE_SIZE = IS_MOBILE_DEVICE ? 512 : 1024;
            const downScale = Math.min(1, MAX_TEXTURE_SIZE / Math.max(canvasWidth, canvasHeight));
            canvasWidth = Math.round(canvasWidth * downScale) || 260;
            canvasHeight = Math.round(canvasHeight * downScale) || 130;

            const scaledFontSize = Math.round(rawFontSize * downScale);
            const scaledLineHeight = lineHeight * downScale;

            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const context = canvas.getContext('2d');
            context.font = `bold ${scaledFontSize}px ${fontFamily}`;

            context.fillStyle = customBaseColor;
            context.fillRect(0, 0, canvasWidth, canvasHeight);

            const marginX = Math.round(canvasWidth * 0.04);
            const marginY = Math.round(canvasHeight * 0.04);
            const chamberW = canvasWidth - marginX * 2;
            const chamberH = canvasHeight - marginY * 2;

            context.save();
            context.translate(marginX, marginY);
            if (window.CardStyleManager) {
                const chamberCfg = {
                    ...preset,
                    baseColor: customBaseColor,
                    depthFactor: customDepth,
                    lightColor: customLightColor,
                    lightPosition: customLightPos,
                    lightBrightness: customLightBrightness * 0.85,
                    lightSpread: customLightSpread
                };
                window.CardStyleManager.drawPerspectiveChamber(context, chamberW, chamberH, chamberCfg);
            } else {
                const radGrad = context.createRadialGradient(
                    chamberW / 2, chamberH / 2, Math.min(chamberW, chamberH) * 0.15,
                    chamberW / 2, chamberH / 2, Math.max(chamberW, chamberH) * 0.55
                );
                radGrad.addColorStop(0, customLightColor);
                radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                context.fillStyle = radGrad;
                context.fillRect(0, 0, chamberW, chamberH);
            }
            context.restore();

            context.save();
            context.lineWidth = Math.max(2, Math.round(2 * textureResolutionScale));
            context.strokeStyle = customLightColor;
            context.globalAlpha = 0.65;
            const r = Math.round(canvasWidth * 0.075);
            context.beginPath();
            context.moveTo(r, 1);
            context.lineTo(canvasWidth - r, 1);
            context.quadraticCurveTo(canvasWidth - 1, 1, canvasWidth - 1, r);
            context.lineTo(canvasWidth - 1, canvasHeight - r);
            context.quadraticCurveTo(canvasWidth - 1, canvasHeight - 1, canvasWidth - r, canvasHeight - 1);
            context.lineTo(r, canvasHeight - 1);
            context.quadraticCurveTo(1, canvasHeight - 1, 1, canvasHeight - r);
            context.lineTo(1, r);
            context.quadraticCurveTo(1, 1, r, 1);
            context.closePath();
            context.stroke();
            context.restore();

            const textY = canvasHeight / 2 - ((mainContentLines.length - 1) * scaledLineHeight / 2);
            mainContentLines.forEach((line, index) => {
                const curY = textY + (index * scaledLineHeight);
                if (customTextStyle === 'plain_bold' || !window.CardStyleManager) {
                    context.save();
                    context.textAlign = 'center';
                    context.textBaseline = 'middle';
                    context.strokeStyle = 'rgba(0, 0, 0, 0.95)';
                    context.lineWidth = Math.max(3, scaledFontSize * 0.16);
                    context.strokeText(line, canvasWidth / 2, curY);

                    context.fillStyle = customFontColor;
                    context.fillText(line, canvasWidth / 2, curY);
                    context.restore();
                } else {
                    window.CardStyleManager.draw3DText(context, line, canvasWidth / 2, curY, {
                        fontSize: scaledFontSize,
                        textColor: customFontColor,
                        textStyle: customTextStyle,
                        textDepthColor: preset.textDepthColor || '#070a12',
                        textHighlightColor: customLightColor || preset.textHighlightColor || '#b5f5ff',
                        lightPosition: customLightPos,
                        lightColor: customLightColor,
                        lightBrightness: customLightBrightness
                    });
                }
            });

            return {
                texture: finalizeCanvasTexture(canvas, 8),
                pxWidth: canvasWidth,
                pxHeight: canvasHeight
            };
        },

        createIceCard(word) {
            const texData = this.createCardTexture(word);
            const pxH = texData.pxHeight || 130;
            const pxW = texData.pxWidth || 260;
            const aspect = pxH > 0 ? pxW / pxH : 2.0;

            const sphereRadius = appState.sphereRadius || 85;
            const width = sphereRadius * 0.135;
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

            const minX = x - bevelSize;
            const minY = y - bevelSize;
            const totalW = w + bevelSize * 2;
            const totalH = h + bevelSize * 2;

            const customUVGenerator = {
                generateTopUV: function (geometry, vertices, indexA, indexB, indexC) {
                    const ax = vertices[indexA * 3], ay = vertices[indexA * 3 + 1];
                    const bx = vertices[indexB * 3], by = vertices[indexB * 3 + 1];
                    const cx = vertices[indexC * 3], cy = vertices[indexC * 3 + 1];
                    return [
                        new THREE.Vector2((ax - minX) / totalW, (ay - minY) / totalH),
                        new THREE.Vector2((bx - minX) / totalW, (by - minY) / totalH),
                        new THREE.Vector2((cx - minX) / totalW, (cy - minY) / totalH)
                    ];
                },
                generateSideWallUV: function () {
                    return [
                        new THREE.Vector2(0, 0),
                        new THREE.Vector2(1, 0),
                        new THREE.Vector2(1, 1),
                        new THREE.Vector2(0, 1)
                    ];
                }
            };

            const extrudeSettings = {
                steps: 1,
                depth: depth - bevelThickness * 2,
                bevelEnabled: true,
                bevelThickness: bevelThickness,
                bevelSize: bevelSize,
                bevelOffset: -bevelSize,
                bevelSegments: 4,
                curveSegments: 16,
                UVGenerator: customUVGenerator
            };

            let geometry;
            try {
                geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                geometry.center();
            } catch (e) {
                geometry = new THREE.BoxGeometry(width, height, depth);
            }

            const cardOpacity = parseFloat(document.getElementById('cardOpacityRange')?.value || '0.96');
            const sphereCardBrightness = parseFloat(document.getElementById('sphereCardBrightnessRange')?.value || '0.50');
            const cardExposure = parseFloat(document.getElementById('cardExposureRange')?.value || '0.35');
            const customBaseColor = document.getElementById('cardBaseColor')?.value || '#06122a';
            const customLightColor = document.getElementById('cardLightColor')?.value || '#00f0ff';
            const baseEmissiveIntensity = Math.min(2.0, sphereCardBrightness);

            const frontMat = new THREE.MeshStandardMaterial({
                map: texData.texture,
                emissiveMap: texData.texture,
                color: new THREE.Color(cardExposure, cardExposure, cardExposure),
                emissive: new THREE.Color(0xffffff),
                emissiveIntensity: baseEmissiveIntensity,
                roughness: 0.85,
                metalness: 0.1,
                transparent: true,
                opacity: cardOpacity,
                visible: (cardOpacity > 0.001),
                side: THREE.FrontSide
            });

            const sideMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(customBaseColor),
                roughness: 0.90,
                metalness: 0.15,
                transparent: true,
                opacity: cardOpacity * 0.8,
                visible: (cardOpacity > 0.001),
                emissive: new THREE.Color(customLightColor),
                emissiveIntensity: 0.15,
                side: THREE.DoubleSide
            });

            const materials = [frontMat, sideMat];
            const card = new THREE.Mesh(geometry, materials);

            card.userData = {
                word: word,
                originalMaterials: materials,
                baseEmissiveIntensity: baseEmissiveIntensity,
                hoverSideMaterial: sideMat.clone(),
                rotationAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
                rotationSpeed: 0.3 + Math.random() * 0.7
            };

            return card;
        },

        // ★ 紧致化拐角：紧贴卡片主体四角，不再向外大幅凸出侵占视野
        createCornerBrackets() {
            const bracketGroup = new THREE.Group();
            const bracketCanvas = document.createElement('canvas');
            bracketCanvas.width = 128;
            bracketCanvas.height = 128;
            const ctx = bracketCanvas.getContext('2d');

            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            ctx.strokeStyle = 'rgba(0, 220, 255, 0.35)';
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(14, 60);
            ctx.lineTo(14, 14);
            ctx.lineTo(60, 14);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(120, 240, 255, 0.85)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(14, 60);
            ctx.lineTo(14, 14);
            ctx.lineTo(60, 14);
            ctx.stroke();

            const bracketTexture = new THREE.CanvasTexture(bracketCanvas);

            const bracketMat = new THREE.MeshBasicMaterial({
                map: bracketTexture,
                color: 0x88e8ff,
                transparent: true,
                opacity: 0.65,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                depthTest: false
            });

            const size = 0.16;
            const bracketGeo = new THREE.PlaneGeometry(size, size);

            for (let i = 0; i < 4; i++) {
                const bracket = new THREE.Mesh(bracketGeo, bracketMat.clone());
                const signX = (i % 2 === 0) ? -1 : 1;
                const signY = (i < 2) ? 1 : -1;
                bracket.position.set(signX * (0.5 - size * 0.22), signY * (0.5 - size * 0.22), 0.01);

                let rotation = 0;
                if (signX === 1 && signY === 1) rotation = -Math.PI / 2;
                else if (signX === -1 && signY === -1) rotation = Math.PI / 2;
                else if (signX === 1 && signY === -1) rotation = Math.PI;
                bracket.rotation.z = rotation;
                bracketGroup.add(bracket);
            }
            return bracketGroup;
        },

        // ★ 核心优化：去除原先夸张的内边距，左右只保留相当于 2 个屏幕像素的极微小缓冲
        createOverlayTexture(word) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const fontFamily = "'Segoe UI', 'Roboto', 'Microsoft YaHei', sans-serif";

            const rawBrightness = parseFloat(document.getElementById('hoverCardBrightness')?.value || '1.0');
            const isPitchBlack = (rawBrightness <= 0.001);

            const mainWordColor = document.getElementById('hoverCardMainWordColor')?.value || '#ffffff';
            const phoneticColor = document.getElementById('hoverCardPhoneticColor')?.value || '#A0FFEE';
            const meaningColor = document.getElementById('hoverCardMeaningColor')?.value || '#ffffff';
            const methodTitleColor = document.getElementById('hoverCardMethodTitleColor')?.value || '#FFE600';
            const methodContentColor = document.getElementById('hoverCardMethodContentColor')?.value || '#A0FFEE';

            const dpr = window.devicePixelRatio || 1;
            const scale = IS_MOBILE_DEVICE ? Math.min(dpr, 1.8) : 1.0;
            const canvasWidth = Math.round(1240 * scale);
            const baseSize = 1240 * 0.038 * scale;

            // ★ 边距几乎忽略：只留约 2 个像素 (在 1240 canvas 比例下仅约 4~8px) 作为缓冲
            const paddingX = Math.max(4, Math.round(4 * scale));
            const paddingY = Math.max(14, Math.round(18 * scale));
            const wrapWidth = canvasWidth - paddingX * 2;

            const englishWord = (word.words || 'N/A').trim();
            const phoneticSymbol = word.phonetic ? `/${word.phonetic.replace(/^\/+|\/+$/g, '')}/` : '';
            const chineseMeaning = word.chinese || '无释义';
            const memoryMethod = word.method || '暂无联想记忆提示';
            const notesCount = (Array.isArray(word.notes) ? word.notes.length : 0);
            const isPinned = !!appState.isHoverCardPinned;

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

            let mainFontSize = Math.round(baseSize * 1.55);
            const fontPhonetic = `${Math.round(baseSize * 0.95)}px ${fontFamily}`;
            const fontMeaning = `bold ${Math.round(baseSize * 1.25)}px ${fontFamily}`;
            const fontTitle = `bold ${Math.round(baseSize * 1.05)}px ${fontFamily}`;
            const fontMethod = `bold ${Math.round(baseSize * 1.15)}px ${fontFamily}`;
            const fontButton = `bold ${Math.round(baseSize * 0.76)}px ${fontFamily}`;

            // 计算右上角胶囊布局参数
            const btnHeight = baseSize * 0.95;
            const spacing = 5 * scale;
            const btnY = paddingY + (baseSize * 1.55 - btnHeight) / 2;

            const btnWidthIcon = baseSize * 1.05;
            const btnWidthA = baseSize * 0.95;

            const btnShieldW = btnWidthIcon;
            const btnNoteW = notesCount > 0 ? Math.round(btnWidthIcon * 1.35) : btnWidthIcon;
            const btnPinW = btnWidthIcon;
            const btnPlusW = btnWidthA;
            const btnMinusW = btnWidthA;
            const btnSpeakerW = btnWidthIcon;

            const btnShieldX = canvasWidth - paddingX - btnShieldW;
            const btnNoteX = btnShieldX - spacing - btnNoteW;
            const btnPinX = btnNoteX - spacing - btnPinW;
            const btnPlusX = btnPinX - spacing - btnPlusW;
            const btnMinusX = btnPlusX - spacing - btnMinusW;
            const btnSpeakerX = btnMinusX - spacing - btnSpeakerW;

            // 检测主词是否过长，若过长则适度紧凑字号防止与右上角胶囊冲突
            testCtx.font = `bold ${mainFontSize}px ${fontFamily}`;
            let testWordW = testCtx.measureText(englishWord).width;
            const maxWordSpace = btnSpeakerX - paddingX - (16 * scale);
            if (testWordW > maxWordSpace && maxWordSpace > 50) {
                const shrink = Math.max(0.65, maxWordSpace / testWordW);
                mainFontSize = Math.round(mainFontSize * shrink);
            }
            const fontMain = `bold ${mainFontSize}px ${fontFamily}`;

            const meaningLines = wrapText(chineseMeaning, fontMeaning, wrapWidth);
            const methodLines = wrapText(memoryMethod, fontMethod, wrapWidth);

            let currentY = paddingY;
            const mainWordHeight = baseSize * 1.8;
            currentY += mainWordHeight;

            const meaningLineHeight = baseSize * 1.5;
            currentY += meaningLines.length * meaningLineHeight + baseSize * 0.4;
            currentY += baseSize * 0.6;
            currentY += baseSize * 1.3;

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

            // 1. 主单词靠左对齐 (距左边界仅 2px 微缓冲)
            context.textAlign = "left";
            context.font = fontMain;
            context.fillStyle = mainWordColor;
            context.save();
            context.shadowColor = mainWordColor;
            context.shadowBlur = Math.round(16 * scale * Math.min(2.0, rawBrightness));
            context.fillText(englishWord, paddingX, paddingY);
            context.restore();

            testCtx.font = fontMain;
            const wordWidth = testCtx.measureText(englishWord).width;

            // 音标
            context.font = fontPhonetic;
            context.fillStyle = phoneticColor;
            context.save();
            context.shadowColor = phoneticColor;
            context.shadowBlur = Math.round(8 * scale * Math.min(2.0, rawBrightness));
            context.fillText(phoneticSymbol, paddingX + wordWidth + 18 * scale, paddingY + (baseSize * 0.40));
            context.restore();

            // 2. 右上角功能胶囊纯图标化靠右紧贴边缘
            const zones = [];

            function drawPillButton(label, x, y, w, h, variant = 'normal') {
                context.save();
                if (variant === 'shield') {
                    context.fillStyle = "rgba(220, 38, 38, 0.18)";
                    context.strokeStyle = "rgba(255, 120, 120, 0.65)";
                } else if (variant === 'note') {
                    context.fillStyle = "rgba(255, 216, 117, 0.22)";
                    context.strokeStyle = "rgba(255, 216, 117, 0.75)";
                } else if (variant === 'pinned') {
                    context.fillStyle = "rgba(255, 216, 117, 0.35)";
                    context.strokeStyle = "rgba(255, 216, 117, 0.95)";
                } else if (variant === 'pin') {
                    context.fillStyle = "rgba(0, 240, 255, 0.18)";
                    context.strokeStyle = "rgba(0, 240, 255, 0.85)";
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
                if (variant === 'shield') {
                    context.fillStyle = "#ffb3b3";
                } else if (variant === 'note') {
                    context.fillStyle = "#ffd875";
                } else if (variant === 'pinned') {
                    context.fillStyle = "#ffd875";
                } else if (variant === 'pin') {
                    context.fillStyle = "#b9f6ff";
                } else {
                    context.fillStyle = "rgba(180, 230, 255, 0.95)";
                }
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.shadowColor = "rgba(0, 0, 0, 0.8)";
                context.shadowBlur = 4;
                context.fillText(label, x + w / 2, y + h / 2);
                context.restore();
            }

            drawPillButton("🔊", btnSpeakerX, btnY, btnSpeakerW, btnHeight, 'normal');
            zones.push({ type: 'speak', xMin: btnSpeakerX - 6, xMax: btnSpeakerX + btnSpeakerW + 6, yMin: btnY - 6, yMax: btnY + btnHeight + 6 });

            drawPillButton("A-", btnMinusX, btnY, btnMinusW, btnHeight, 'normal');
            zones.push({ type: 'fontSizeDown', xMin: btnMinusX - 6, xMax: btnMinusX + btnMinusW + 6, yMin: btnY - 6, yMax: btnY + btnHeight + 6 });

            drawPillButton("A+", btnPlusX, btnY, btnPlusW, btnHeight, 'normal');
            zones.push({ type: 'fontSizeUp', xMin: btnPlusX - 6, xMax: btnPlusX + btnPlusW + 6, yMin: btnY - 6, yMax: btnY + btnHeight + 6 });

            const pinIcon = isPinned ? "🔒" : "📌";
            drawPillButton(pinIcon, btnPinX, btnY, btnPinW, btnHeight, isPinned ? 'pinned' : 'pin');
            zones.push({ type: 'togglePin', xMin: btnPinX - 6, xMax: btnPinX + btnPinW + 6, yMin: btnY - 6, yMax: btnY + btnHeight + 6 });

            const noteIcon = notesCount > 0 ? "📝" + notesCount : "📝";
            drawPillButton(noteIcon, btnNoteX, btnY, btnNoteW, btnHeight, 'note');
            zones.push({ type: 'note', xMin: btnNoteX - 6, xMax: btnNoteX + btnNoteW + 6, yMin: btnY - 6, yMax: btnY + btnHeight + 6 });

            drawPillButton("🛡️", btnShieldX, btnY, btnShieldW, btnHeight, 'shield');
            zones.push({ type: 'shield', xMin: btnShieldX - 6, xMax: btnShieldX + btnShieldW + 6, yMin: btnY - 6, yMax: btnY + btnHeight + 6 });

            zones.push({ type: 'speak', xMin: paddingX - 10, xMax: btnSpeakerX - spacing, yMin: paddingY - 10, yMax: paddingY + mainWordHeight + 10 });

            // 3. 中文释义 (铺满超宽 wrapWidth)
            let writeY = paddingY + mainWordHeight;
            context.font = fontMeaning;
            context.fillStyle = meaningColor;
            context.save();
            context.shadowColor = meaningColor;
            context.shadowBlur = Math.round(10 * scale * Math.min(2.0, rawBrightness));
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
            context.fillStyle = methodTitleColor;
            context.save();
            context.shadowColor = methodTitleColor;
            context.shadowBlur = Math.round(12 * scale * Math.min(2.0, rawBrightness));
            context.fillText("💡 记忆方法 / Memory Association", paddingX, writeY);
            context.restore();

            // 6. 记忆方法正文 (铺满超宽 wrapWidth)
            writeY += baseSize * 1.35;
            context.font = fontMethod;
            context.fillStyle = methodContentColor;
            context.save();
            context.shadowColor = methodContentColor;
            context.shadowBlur = Math.round(8 * scale * Math.min(2.0, rawBrightness));
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