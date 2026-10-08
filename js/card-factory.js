/**
 * 3D单词宇宙 - 卡片工坊 (Card Factory)
 * 100% 还原参考代码与截图：3D四角发光括号、右上角4个高灵敏功能按钮 [🔊] [A-] [A+] [屏蔽]、舒适大边距
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
        /**
         * 0ms 极速就地更新网格材质属性 (不触发 Canvas 重构)
         */
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
            const customTextStyle = document.getElementById('cardTextStyleSelect')?.value || preset.textStyle || 'relief_metal';
            const customFontColor = document.getElementById('sphereCardFontColor')?.value || preset.textColor || '#ffffff';

            const stormStyleCb = document.getElementById('stormWordCardStyleEnabled');
            const isStormStyled = word.isStormWord && stormStyleCb && stormStyleCb.checked;

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
                    lightColor: isStormStyled ? '#ffea00' : customLightColor,
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
                        textColor: isStormStyled ? '#000000' : customFontColor,
                        textStyle: isStormStyled ? 'relief_metal' : customTextStyle,
                        textDepthColor: isStormStyled ? '#3d2500' : (preset.textDepthColor || '#070a12'),
                        textHighlightColor: isStormStyled ? '#ffffff' : (preset.textHighlightColor || '#b5f5ff'),
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
                resolutionScale: textureResolutionScale,
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
                steps: 1,
                depth: depth - bevelThickness * 2,
                bevelEnabled: true,
                bevelThickness: bevelThickness,
                bevelSize: bevelSize,
                bevelOffset: -bevelSize,
                bevelSegments: 4,
                curveSegments: 16,
                UVGenerator: {
                    generateTopUV: function (geometry, vertices, indexA, indexB, indexC) {
                        const ax = vertices[indexA * 3], ay = vertices[indexA * 3 + 1];
                        const bx = vertices[indexB * 3], by = vertices[indexB * 3 + 1];
                        const cx = vertices[indexC * 3], cy = vertices[indexC * 3 + 1];
                        return [
                            new THREE.Vector2((ax - x) / w, (ay - y) / h),
                            new THREE.Vector2((bx - x) / w, (by - y) / h),
                            new THREE.Vector2((cx - x) / w, (cy - y) / h)
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
                }
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
                map: texData.texture,
                roughness: 0.85,
                metalness: 0.15,
                transparent: true,
                opacity: cardOpacity,
                visible: (cardOpacity > 0.001),
                side: THREE.FrontSide
            });

            const sideEmissiveColor = new THREE.Color(texData.lightColor || 0x00bfff);
            const sideEmissiveIntensity = Math.max(0, texData.lightBrightness * 0.35);

            const sideMat = new THREE.MeshStandardMaterial({
                color: 0x0a162b,
                roughness: 0.85,
                metalness: 0.25,
                transparent: true,
                opacity: cardOpacity * 0.45,
                visible: (cardOpacity > 0.001),
                emissive: sideEmissiveColor,
                emissiveIntensity: sideEmissiveIntensity,
                side: THREE.DoubleSide
            });

            const materials = [frontMat, sideMat];
            const card = new THREE.Mesh(geometry, materials);

            card.userData = {
                word: word,
                originalMaterials: materials,
                hoverSideMaterial: sideMat.clone(),
                rotationAxis: new THREE.Vector3(
                    Math.random() - 0.5,
                    Math.random() - 0.5,
                    Math.random() - 0.5
                ).normalize(),
                rotationSpeed: 0.3 + Math.random() * 0.7
            };

            return card;
        },

        /**
         * 3D 发光四角括号生成器 (还原老版本 3D 空间直角括号)
         */
        createCornerBrackets() {
            const bracketGroup = new THREE.Group();
            const bracketCanvas = document.createElement('canvas');
            bracketCanvas.width = 64;
            bracketCanvas.height = 64;
            const ctx = bracketCanvas.getContext('2d');
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(6, 32);
            ctx.lineTo(6, 6);
            ctx.lineTo(32, 6);
            ctx.stroke();
            const bracketTexture = new THREE.CanvasTexture(bracketCanvas);

            const bracketMat = new THREE.MeshBasicMaterial({
                map: bracketTexture,
                color: 0x00ffff,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                depthTest: false
            });

            const size = 0.26;
            const bracketGeo = new THREE.PlaneGeometry(size, size);

            for (let i = 0; i < 4; i++) {
                const bracket = new THREE.Mesh(bracketGeo, bracketMat.clone());
                const signX = (i % 2 === 0) ? -1 : 1;
                const signY = (i < 2) ? 1 : -1;
                // 定位在卡片外边缘处形成科技包围框
                bracket.position.set(signX * 0.52, signY * 0.52, 0.03);

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
         * 3D 浮动查词卡片初始化
         */
        initPremiumHoverCard() {
            const premiumCardGroup = new THREE.Group();
            const backplateGeo = new THREE.PlaneGeometry(1, 1);
            const backplateMat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(0x0a1428),
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                depthTest: false,
                depthWrite: false
            });
            const backplate = new THREE.Mesh(backplateGeo, backplateMat);
            backplate.name = "backplate";
            backplate.renderOrder = 9995;
            backplate.raycast = () => {}; // 禁用背面拾取，由文字屏幕响应
            premiumCardGroup.add(backplate);

            const glowCanvas = document.createElement('canvas');
            glowCanvas.width = 128; glowCanvas.height = 128;
            const glowCtx = glowCanvas.getContext('2d');
            const gradient = glowCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
            gradient.addColorStop(0, "rgba(100, 200, 255, 0.4)");
            gradient.addColorStop(1, "rgba(50, 100, 150, 0)");
            glowCtx.fillStyle = gradient;
            glowCtx.fillRect(0, 0, 128, 128);

            const glowTexture = new THREE.CanvasTexture(glowCanvas);
            const glowMat = new THREE.MeshBasicMaterial({
                map: glowTexture,
                blending: THREE.AdditiveBlending,
                transparent: true,
                opacity: 0,
                depthTest: false,
                depthWrite: false
            });
            const coreGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), glowMat);
            coreGlow.name = "coreGlow";
            coreGlow.position.z = 0.01;
            coreGlow.renderOrder = 9996;
            coreGlow.raycast = () => {};
            premiumCardGroup.add(coreGlow);

            const screenGeo = new THREE.PlaneGeometry(1, 1);
            const screenMat = new THREE.MeshBasicMaterial({
                map: null,
                transparent: true,
                opacity: 0,
                depthTest: false,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            const screen = new THREE.Mesh(screenGeo, screenMat);
            screen.position.z = 0.02;
            screen.name = "textScreen";
            screen.renderOrder = 9998;
            premiumCardGroup.add(screen);

            // 加入发光四角括号 frameGroup
            const cornerBracketsGroup = this.createCornerBrackets();
            cornerBracketsGroup.name = 'frameGroup';
            cornerBracketsGroup.position.z = 0.03;
            cornerBracketsGroup.children.forEach(child => {
                child.renderOrder = 9997;
                child.material.depthTest = false;
                child.material.depthWrite = false;
                child.raycast = () => {};
            });
            premiumCardGroup.add(cornerBracketsGroup);

            premiumCardGroup.renderOrder = 9999;
            premiumCardGroup.visible = false;
            appState.scene.add(premiumCardGroup);
            return premiumCardGroup;
        },

        /**
         * 100% 还原参考代码 createOverlayTexture (深透微缩背景、宽边距、右上角4个功能按钮 [🔊] [A-] [A+] [屏蔽])
         */
        createOverlayTexture(word) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const fontFamily = "'Segoe UI', 'Roboto', 'Microsoft YaHei', sans-serif";

            const hoverStyleMode = document.getElementById('hoverCardStyleModeSelect')?.value || 'classic_hud';
            const rawBrightness = parseFloat(document.getElementById('hoverCardBrightness')?.value || '1.0');
            const isPitchBlack = (rawBrightness <= 0.001);

            const mainWordColor = document.getElementById('hoverCardTextMainWordColor')?.value || '#FFFFFF';
            const valueColor = document.getElementById('hoverCardTextValueColor')?.value || '#FFFFFF';
            const labelColor = document.getElementById('hoverCardTextLabelColor')?.value || '#8CFEFF';
            const textGlowColor = document.getElementById('hoverCardTextGlowColor')?.value || '#00FFFF';
            const textGlowIntensity = parseFloat(document.getElementById('hoverCardTextGlowIntensity')?.value || '0.5');

            const dpr = window.devicePixelRatio || 1;
            const scale = IS_MOBILE_DEVICE ? Math.min(dpr, 1.8) : 1.0;

            const canvasWidth = Math.round(1240 * scale);
            const baseSize = 1240 * 0.038 * scale;
            const paddingX = Math.round(70 * scale);
            const paddingY = Math.round(50 * scale);
            const wrapWidth = canvasWidth - paddingX * 2;

            const englishWord = (word.words || 'N/A').trim();
            const phoneticSymbol = word.phonetic || '';
            const chineseMeaning = word.chinese || '无释义';
            const memoryMethod = word.method || '暂无联想记忆提示';

            const testCtx = getSharedTestContext();

            function wrapText(text, font, maxWidth) {
                testCtx.font = font;
                const lines = [];
                let currentLine = "";
                const chars = text.split("");
                for (let i = 0; i < chars.length; i++) {
                    let testLine = currentLine + chars[i];
                    let metrics = testCtx.measureText(testLine);
                    if (metrics.width > maxWidth && i > 0) {
                        lines.push(currentLine);
                        currentLine = chars[i];
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
            const fontButton = `bold ${Math.round(baseSize * 0.72)}px ${fontFamily}`;

            const meaningLines = wrapText(chineseMeaning, fontMeaning, wrapWidth);
            const methodLines = wrapText(memoryMethod, fontMethod, wrapWidth);

            let currentY = paddingY;
            const mainWordHeight = baseSize * 1.8;
            currentY += mainWordHeight;

            const meaningLineHeight = baseSize * 1.5;
            const meaningHeight = meaningLines.length * meaningLineHeight;
            currentY += meaningHeight + baseSize * 0.4;

            currentY += baseSize * 0.6; // 分割线
            currentY += baseSize * 1.3; // 记忆法标题

            const methodLineHeight = baseSize * 1.3;
            const methodHeight = methodLines.length * methodLineHeight;
            currentY += methodHeight + paddingY;

            const canvasHeight = Math.round(currentY);
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            context.clearRect(0, 0, canvasWidth, canvasHeight);

            // 若亮度归零，纯黑无光
            if (isPitchBlack) {
                context.fillStyle = '#000000';
                context.fillRect(0, 0, canvasWidth, canvasHeight);
            } else if (hoverStyleMode === 'sync_sphere' && window.CardStyleManager) {
                // 联动球体样机风格
                const currentPresetId = document.getElementById('cardStylePresetSelect')?.value || 'cyber_blue';
                const preset = window.CardStyleManager.getPreset(currentPresetId);
                const customLightColor = document.getElementById('cardLightColor')?.value || preset.defaultLightColor || '#00f0ff';
                window.CardStyleManager.drawPerspectiveChamber(context, canvasWidth, canvasHeight, {
                    ...preset,
                    depthFactor: 0.75,
                    lightColor: customLightColor,
                    lightPosition: 'top',
                    lightBrightness: rawBrightness * 0.75,
                    lightSpread: 0.95
                });
            }

            context.shadowColor = isPitchBlack ? 'transparent' : textGlowColor;
            context.shadowBlur = isPitchBlack ? 0 : textGlowIntensity * 20 * scale;
            context.textBaseline = 'top';

            // 1. 主单词
            context.textAlign = "left";
            context.font = fontMain;
            context.fillStyle = mainWordColor;
            context.fillText(englishWord, paddingX, paddingY);

            testCtx.font = fontMain;
            const wordWidth = testCtx.measureText(englishWord).width;

            // 2. 音标
            context.font = fontPhonetic;
            context.fillStyle = labelColor;
            context.fillText(phoneticSymbol, paddingX + wordWidth + 25 * scale, paddingY + (baseSize * 0.35));

            // 3. 右上角按钮 (🔊, A-, A+, 屏蔽)
            const btnHeight = baseSize * 0.95;
            const spacing = 8 * scale;
            const btnY = paddingY + (baseSize * 1.55 - btnHeight) / 2;

            const btnWidthSpeaker = baseSize * 1.25;
            const btnWidthA = baseSize * 1.1;
            const btnWidthShield = baseSize * 1.6;

            const btnShieldX = canvasWidth - paddingX - btnWidthShield;
            const btnPlusX = btnShieldX - spacing - btnWidthA;
            const btnMinusX = btnPlusX - spacing - btnWidthA;
            const btnSpeakerX = btnMinusX - spacing - btnWidthSpeaker;

            const zones = [];

            function drawPillButton(label, x, y, w, h) {
                context.save();
                context.fillStyle = "rgba(0, 240, 255, 0.05)";
                context.strokeStyle = "rgba(0, 240, 255, 0.35)";
                context.lineWidth = Math.max(1.0, 1.2 * scale);
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
                context.fillStyle = "rgba(162, 216, 255, 0.90)";
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.fillText(label, x + w / 2, y + h / 2);
                context.restore();
            }

            drawPillButton("🔊", btnSpeakerX, btnY, btnWidthSpeaker, btnHeight);
            zones.push({ type: 'speak', xMin: btnSpeakerX - 6, xMax: btnSpeakerX + btnWidthSpeaker + 6, yMin: btnY - 6, yMax: btnY + btnHeight + 6 });

            drawPillButton("A-", btnMinusX, btnY, btnWidthA, btnHeight);
            zones.push({ type: 'fontSizeDown', xMin: btnMinusX - 6, xMax: btnMinusX + btnWidthA + 6, yMin: btnY - 6, yMax: btnY + btnHeight + 6 });

            drawPillButton("A+", btnPlusX, btnY, btnWidthA, btnHeight);
            zones.push({ type: 'fontSizeUp', xMin: btnPlusX - 6, xMax: btnPlusX + btnWidthA + 6, yMin: btnY - 6, yMax: btnY + btnHeight + 6 });

            drawPillButton("屏蔽", btnShieldX, btnY, btnWidthShield, btnHeight);
            zones.push({ type: 'shield', xMin: btnShieldX - 6, xMax: btnShieldX + btnWidthShield + 6, yMin: btnY - 6, yMax: btnY + btnHeight + 6 });

            // 主单词发音区域
            zones.push({ type: 'word', xMin: paddingX - 10, xMax: btnSpeakerX - spacing, yMin: paddingY - 10, yMax: paddingY + baseSize * 1.8 });

            // 4. 多行释义
            let writeY = paddingY + mainWordHeight;
            context.font = fontMeaning;
            context.fillStyle = valueColor;
            meaningLines.forEach(line => {
                context.fillText(line, paddingX, writeY);
                writeY += meaningLineHeight;
            });

            // 5. 装饰分割线
            writeY += baseSize * 0.4;
            context.strokeStyle = "rgba(104, 240, 255, 0.25)";
            context.lineWidth = Math.max(1, Math.round(1 * scale));
            context.beginPath();
            context.moveTo(paddingX, writeY);
            context.lineTo(canvasWidth - paddingX, writeY);
            context.stroke();

            // 6. 记忆方法标题 (金黄色醒目标题)
            writeY += baseSize * 0.6;
            context.font = fontTitle;
            context.fillStyle = "#FFD700";
            context.fillText("💡 记忆方法 / Memory Association", paddingX, writeY);

            // 7. 记忆方法正文
            writeY += baseSize * 1.3;
            context.font = fontMethod;
            context.fillStyle = "rgba(255, 255, 192, 0.95)";
            methodLines.forEach(line => {
                context.fillText(line, paddingX, writeY);
                writeY += methodLineHeight;
            });

            // 8. 卡片腹地命中保护，防止点击卡片内部空白误关
            zones.push({ type: 'card_body', xMin: 0, xMax: canvasWidth, yMin: 0, yMax: canvasHeight });

            word.hover_click_zones = zones;
            if (appState.hoverOverlayCard) {
                appState.hoverOverlayCard.userData.hover_click_zones = zones;
            }

            const tex = new THREE.CanvasTexture(canvas);
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.generateMipmaps = true;
            if (appState.renderer) {
                const maxAnisotropy = appState.renderer.capabilities.getMaxAnisotropy();
                tex.anisotropy = Math.min(4, maxAnisotropy);
            }

            return { texture: tex, pxWidth: canvasWidth, pxHeight: canvasHeight };
        },

        updateCardWordData(card, newWord) {
            if (!card || !newWord) return;
            card.userData.word = newWord;
            const texData = this.createCardTexture(newWord);
            if (Array.isArray(card.material) && card.material[0] && card.material[0].map) {
                card.material[0].map.dispose();
                card.material[0].map = texData.texture;
                card.material[0].needsUpdate = true;
            }
        }
    };

    window.AppCardFactory = AppCardFactory;
    window.disposeObject = disposeObject;
})();