/**
 * 3D单词宇宙 - 卡片工坊 (Card Factory)
 * 完美还原附件参考图样式：宽安全边距、右上角4个功能按钮 [🔊] [A-] [A+] [屏蔽]、发光四角括号
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
         * 0ms 就地极速更新网格材质属性 (不触发 Canvas 重建)
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
            let padding = rawFontSize * 1.35; // 增加边距，防止贴边
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
         * ★ 100% 还原参考图片的查词卡片 (宽安全边距、右上角4个功能按钮 [🔊] [A-] [A+] [屏蔽]、四角发光括号)
         */
        createOverlayTexture(word) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const fontFamily = "'Segoe UI', 'Roboto', 'Microsoft YaHei', sans-serif";

            const hoverStyleMode = document.getElementById('hoverCardStyleModeSelect')?.value || 'classic_hud';
            const rawBrightness = parseFloat(document.getElementById('hoverCardBrightness')?.value || '1.0');
            const isPitchBlack = (rawBrightness <= 0.001);

            const dpr = window.devicePixelRatio || 1;
            const scale = IS_MOBILE_DEVICE ? Math.min(dpr, 1.8) : 1.0;
            const canvasWidth = Math.round(1320 * scale);
            const baseSize = 1320 * 0.036 * scale;

            // 显著加大左右与上下内边距，文字远离边缘
            const paddingX = Math.round(85 * scale);
            const paddingY = Math.round(62 * scale);
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

            const fontMain = `bold ${Math.round(baseSize * 1.65)}px ${fontFamily}`;
            const fontPhonetic = `${Math.round(baseSize * 1.02)}px ${fontFamily}`;
            const fontMeaning = `bold ${Math.round(baseSize * 1.30)}px ${fontFamily}`;
            const fontTitle = `bold ${Math.round(baseSize * 1.15)}px ${fontFamily}`;
            const fontMethod = `bold ${Math.round(baseSize * 1.20)}px ${fontFamily}`;
            const fontButton = `bold ${Math.round(baseSize * 0.76)}px ${fontFamily}`;

            const meaningLines = wrapText(chineseMeaning, fontMeaning, wrapWidth);
            const methodLines = wrapText(memoryMethod, fontMethod, wrapWidth);

            let calculatedH = paddingY + baseSize * 2.0 + meaningLines.length * (baseSize * 1.6) + baseSize * 2.2 + methodLines.length * (baseSize * 1.45) + paddingY;
            const canvasHeight = Math.round(calculatedH);
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            // 1. 绘制背景底板
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
            } else {
                // 经典星云赛博卡片 (100% 对齐用户图片：深蓝太空渐变 + 柔和内光 + 晶莹发光边框)
                context.clearRect(0, 0, canvasWidth, canvasHeight);

                const bgGrad = context.createLinearGradient(0, 0, 0, canvasHeight);
                bgGrad.addColorStop(0, "rgba(8, 22, 54, 0.94)");
                bgGrad.addColorStop(0.5, "rgba(12, 28, 68, 0.96)");
                bgGrad.addColorStop(1, "rgba(6, 16, 42, 0.98)");
                context.fillStyle = bgGrad;

                window.CardStyleManager.drawRoundedRectPath(context, 16 * scale, 16 * scale, canvasWidth - 32 * scale, canvasHeight - 32 * scale, 24 * scale);
                context.fill();

                // 柔和幽蓝环境泛光
                const innerGlow = context.createRadialGradient(canvasWidth * 0.4, canvasHeight * 0.45, 10, canvasWidth * 0.4, canvasHeight * 0.45, canvasWidth * 0.55);
                innerGlow.addColorStop(0, `rgba(0, 220, 255, ${(0.15 * Math.min(2.0, rawBrightness)).toFixed(3)})`);
                innerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
                context.fillStyle = innerGlow;
                window.CardStyleManager.drawRoundedRectPath(context, 16 * scale, 16 * scale, canvasWidth - 32 * scale, canvasHeight - 32 * scale, 24 * scale);
                context.fill();

                // 晶莹发光边框
                context.save();
                context.strokeStyle = "rgba(0, 240, 255, 0.45)";
                context.lineWidth = Math.max(1.5, 2.0 * scale);
                context.shadowColor = "#00f0ff";
                context.shadowBlur = 15 * scale;
                window.CardStyleManager.drawRoundedRectPath(context, 16 * scale, 16 * scale, canvasWidth - 32 * scale, canvasHeight - 32 * scale, 24 * scale);
                context.stroke();
                context.restore();

                // 四角发光角括号 ┌ ┐ └ ┘
                window.CardStyleManager.drawCyberCornerBrackets(context, 8 * scale, 8 * scale, canvasWidth - 16 * scale, canvasHeight - 16 * scale, 55 * scale, '#00f0ff');
            }

            context.textBaseline = 'top';

            // 2. 左上角：主单词与音标
            context.textAlign = "left";
            context.font = fontMain;
            context.fillStyle = "#ffffff";
            context.save();
            context.shadowColor = "rgba(0, 240, 255, 0.85)";
            context.shadowBlur = 16 * scale;
            context.fillText(englishWord, paddingX, paddingY);
            context.restore();

            testCtx.font = fontMain;
            const wordWidth = testCtx.measureText(englishWord).width;

            context.font = fontPhonetic;
            context.fillStyle = "#A0FFEE";
            context.fillText(phoneticSymbol, paddingX + wordWidth + 24 * scale, paddingY + (baseSize * 0.45));

            // 3. 右上角：4 个功能胶囊按钮 [🔊] [A-] [A+] [屏蔽]
            const btnHeight = baseSize * 1.05;
            const spacing = 12 * scale;
            const btnY = paddingY;

            const btnWidthShield = baseSize * 1.95;
            const btnWidthA = baseSize * 1.25;
            const btnWidthSpeak = baseSize * 1.35;

            const btnShieldX = canvasWidth - paddingX - btnWidthShield;
            const btnPlusX = btnShieldX - spacing - btnWidthA;
            const btnMinusX = btnPlusX - spacing - btnWidthA;
            const btnSpeakX = btnMinusX - spacing - btnWidthSpeak;

            word.hover_click_zones = [];

            function drawPillButton(label, x, y, w, h, isShield = false) {
                context.save();
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

                // 渐变底色
                const bg = context.createLinearGradient(x, y, x, y + h);
                if (isShield) {
                    bg.addColorStop(0, "rgba(239, 68, 68, 0.35)");
                    bg.addColorStop(1, "rgba(185, 28, 28, 0.65)");
                } else {
                    bg.addColorStop(0, "rgba(0, 200, 255, 0.28)");
                    bg.addColorStop(1, "rgba(8, 48, 100, 0.65)");
                }
                context.fillStyle = bg;
                context.fill();

                // 边缘描边
                context.strokeStyle = isShield ? "rgba(255, 120, 120, 0.85)" : "rgba(0, 240, 255, 0.75)";
                context.lineWidth = Math.max(1.2, 1.6 * scale);
                context.shadowColor = isShield ? "#ef4444" : "#00f0ff";
                context.shadowBlur = 8 * scale;
                context.stroke();

                // 按钮文字/图标
                context.font = fontButton;
                context.fillStyle = "#ffffff";
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.shadowColor = "rgba(0, 0, 0, 0.8)";
                context.shadowBlur = 4;
                context.fillText(label, x + w / 2, y + h / 2);
                context.restore();
            }

            // 绘制 4 个独立按钮
            drawPillButton("🔊", btnSpeakX, btnY, btnWidthSpeak, btnHeight, false);
            word.hover_click_zones.push({
                type: 'speak',
                xMin: btnSpeakX - 4, xMax: btnSpeakX + btnWidthSpeak + 4,
                yMin: btnY - 4, yMax: btnY + btnHeight + 4
            });

            drawPillButton("A-", btnMinusX, btnY, btnWidthA, btnHeight, false);
            word.hover_click_zones.push({
                type: 'fontSizeDown',
                xMin: btnMinusX - 4, xMax: btnMinusX + btnWidthA + 4,
                yMin: btnY - 4, yMax: btnY + btnHeight + 4
            });

            drawPillButton("A+", btnPlusX, btnY, btnWidthA, btnHeight, false);
            word.hover_click_zones.push({
                type: 'fontSizeUp',
                xMin: btnPlusX - 4, xMax: btnPlusX + btnWidthA + 4,
                yMin: btnY - 4, yMax: btnY + btnHeight + 4
            });

            drawPillButton("屏蔽", btnShieldX, btnY, btnWidthShield, btnHeight, true);
            word.hover_click_zones.push({
                type: 'shield',
                xMin: btnShieldX - 4, xMax: btnShieldX + btnWidthShield + 4,
                yMin: btnY - 4, yMax: btnY + btnHeight + 4
            });

            // 主单词点击区域也能朗读
            word.hover_click_zones.push({
                type: 'speak',
                xMin: paddingX - 10, xMax: btnSpeakX - spacing,
                yMin: paddingY - 10, yMax: paddingY + baseSize * 1.8
            });

            // 4. 第二行：中文释义 (如 蚂蚁)
            let writeY = paddingY + baseSize * 2.0;
            context.font = fontMeaning;
            context.fillStyle = "#ffffff";
            context.save();
            context.shadowColor = "rgba(0, 240, 255, 0.7)";
            context.shadowBlur = 12 * scale;
            meaningLines.forEach(line => {
                context.fillText(line, paddingX, writeY);
                writeY += baseSize * 1.55;
            });
            context.restore();

            // 5. 记忆方法标题：💡 记忆方法 / Memory Association (金黄发光，100% 还原图片)
            writeY += baseSize * 0.45;
            context.font = fontTitle;
            context.fillStyle = "#FFE600";
            context.save();
            context.shadowColor = "rgba(255, 230, 0, 0.85)";
            context.shadowBlur = 14 * scale;
            context.fillText("💡 记忆方法 / Memory Association", paddingX, writeY);
            context.restore();

            // 6. 记忆方法内容：(如 一牛头~，明亮青蓝，100% 还原图片)
            writeY += baseSize * 1.45;
            context.font = fontMethod;
            context.fillStyle = "#8EFAFF";
            context.save();
            context.shadowColor = "rgba(0, 240, 255, 0.55)";
            context.shadowBlur = 8 * scale;
            methodLines.forEach(line => {
                context.fillText(line, paddingX, writeY);
                writeY += baseSize * 1.45;
            });
            context.restore();

            // 允许点击卡片主体防止误关
            word.hover_click_zones.push({
                type: 'card_body',
                xMin: 0, xMax: canvasWidth,
                yMin: 0, yMax: canvasHeight
            });

            return {
                texture: finalizeCanvasTexture(canvas, 8),
                pxWidth: canvasWidth,
                pxHeight: canvasHeight
            };
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