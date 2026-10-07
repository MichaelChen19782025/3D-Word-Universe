/**
 * 3D单词宇宙 - 卡片工坊 (Card Factory)
 * 彻底修复 UVGenerator 映射（文字 100% 清晰现身）与图 3 经典太空幽蓝发光质感
 */
(function() {
    let _sharedTestCanvas = null;
    let _sharedTestCtx = null;
    const _cardGeoCache = new Map();
    const _overlayCanvasCache = new Map();

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
        createCardTexture(word) {
            const baseFontSize = APP_CONFIG.DEFAULT_SPHERE_CARD_FONT_SIZE;
            const dpr = window.devicePixelRatio || 1;
            let textureResolutionScale = IS_MOBILE_DEVICE ? Math.min(dpr, 2.0) : 1.0;

            let fontFactor = appState.currentSphereCardFontSizeFactor || 1.0;
            const rawFontSize = Math.round(baseFontSize * fontFactor * textureResolutionScale);
            const fontFamily = document.getElementById('sphereCardFontFamily')?.value || "'Microsoft YaHei', sans-serif";

            const stormStyleCb = document.getElementById('stormWordCardStyleEnabled');
            const isStormStyled = word.isStormWord && stormStyleCb && stormStyleCb.checked;
            const fontColor = isStormStyled ?
                (document.getElementById('stormWordCardFontColor')?.value || '#000000') :
                (document.getElementById('sphereCardFontColor')?.value || '#ffffff');

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

            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const context = canvas.getContext('2d');
            context.font = `bold ${scaledFontSize}px ${fontFamily}`;

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

            context.clearRect(0, 0, canvasWidth, canvasHeight);

            // 1. 图 3 经典太空幽蓝渐变背景底色
            const cardGradient = context.createLinearGradient(0, 0, 0, canvasHeight);
            if (isStormStyled) {
                cardGradient.addColorStop(0, "rgba(255, 140, 0, 0.90)");
                cardGradient.addColorStop(1, "rgba(200, 30, 80, 0.95)");
            } else {
                cardGradient.addColorStop(0, "rgba(6, 18, 42, 0.86)");
                cardGradient.addColorStop(1, "rgba(14, 34, 68, 0.92)");
            }
            context.fillStyle = cardGradient;
            context.fillRect(0, 0, canvasWidth, canvasHeight);

            // 2. 玻璃拟态内层微光
            context.fillStyle = "rgba(255, 255, 255, 0.04)";
            drawRoundedRect(context, 4, 4, canvasWidth - 8, canvasHeight - 8, 12 * textureResolutionScale * downScale);
            context.fill();

            // 3. 核心字体绘制：高对比白色 + 细黑描边与深投影
            context.fillStyle = fontColor;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.shadowColor = "rgba(2, 6, 16, 0.95)";
            context.shadowBlur = 6 * textureResolutionScale * downScale;

            context.strokeStyle = "rgba(10, 22, 45, 0.98)";
            context.lineWidth = scaledFontSize * 0.16;
            context.lineJoin = 'round';

            const textY = canvasHeight / 2 - ((mainContentLines.length - 1) * scaledLineHeight / 2);
            mainContentLines.forEach((line, index) => {
                context.strokeText(line, canvasWidth / 2, textY + (index * scaledLineHeight));
                context.fillText(line, canvasWidth / 2, textY + (index * scaledLineHeight));
            });

            // 4. 球心背光光晕
            const backlightGrad = context.createRadialGradient(canvasWidth/2, canvasHeight/2, 5, canvasWidth/2, canvasHeight/2, canvasWidth * 0.4);
            backlightGrad.addColorStop(0, "rgba(0, 240, 255, 0.12)");
            backlightGrad.addColorStop(1, "rgba(0, 0, 0, 0.0)");
            context.fillStyle = backlightGrad;
            drawRoundedRect(context, 4, 4, canvasWidth - 8, canvasHeight - 8, 12 * textureResolutionScale * downScale);
            context.fill();

            // 5. 荧光青蓝外发光辉光边框
            context.save();
            context.shadowColor = isStormStyled ? "rgba(255, 140, 0, 0.45)" : "rgba(0, 220, 255, 0.38)";
            context.shadowBlur = 10 * textureResolutionScale * downScale;

            const borderGradient = context.createLinearGradient(0, 0, canvasWidth, 0);
            if (isStormStyled) {
                borderGradient.addColorStop(0, "rgba(255, 140, 0, 0.35)");
                borderGradient.addColorStop(1, "rgba(255, 255, 255, 0.4)");
            } else {
                borderGradient.addColorStop(0, "rgba(0, 220, 255, 0.35)");
                borderGradient.addColorStop(1, "rgba(0, 110, 255, 0.35)");
            }
            context.strokeStyle = borderGradient;
            context.lineWidth = Math.max(1.6, 1.6 * textureResolutionScale * downScale);

            drawRoundedRect(context, 4, 4, canvasWidth - 8, canvasHeight - 8, 12 * textureResolutionScale * downScale);
            context.stroke();
            context.restore();

            return {
                texture: finalizeCanvasTexture(canvas, 8),
                pxWidth: canvasWidth,
                pxHeight: canvasHeight,
                resolutionScale: textureResolutionScale
            };
        },

        // 💡 核心修复：补全 UVGenerator，彻底解决文字丢失与拉伸小点的问题
        createIceCard(word) {
            const texData = this.createCardTexture(word);
            const pxH = texData.pxHeight || 92;
            const pxW = texData.pxWidth || 200;
            const aspect = pxH > 0 ? pxW / pxH : 2.0;

            const sphereRadius = appState.sphereRadius || 100;
            const width = sphereRadius * 0.12;
            const height = width / aspect;
            const depth = width * 0.04;

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
                depth: depth - bevelThickness * 2,
                bevelEnabled: true,
                bevelThickness: bevelThickness,
                bevelSize: bevelSize,
                bevelOffset: -bevelSize,
                bevelSegments: 4,
                curveSegments: 16,
                // ⭐️ 核心关键：必须自定义 UVGenerator，将 (x, y) 顶点坐标精确归一化为 (0~1) 贴图坐标！
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

            const frontMat = new THREE.MeshStandardMaterial({
                map: texData.texture,
                roughness: 0.85,
                metalness: 0.1,
                transparent: true,
                opacity: 0.95,
                side: THREE.FrontSide
            });

            const sideMat = new THREE.MeshStandardMaterial({
                color: 0x07204c,
                roughness: 0.85,
                metalness: 0.1,
                transparent: true,
                opacity: 0.35,
                emissive: new THREE.Color(0x00bfff),
                emissiveIntensity: 0.35,
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

        // 💡 图 3 悬浮详情卡大贴图绘制
        createOverlayTexture(word) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const fontFamily = "'Segoe UI', 'Roboto', 'Microsoft YaHei', sans-serif";

            const mainWordColor = document.getElementById('hoverCardTextMainWordColor')?.value || '#FFFFFF';
            const valueColor = document.getElementById('hoverCardTextValueColor')?.value || '#8CFEFF';
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
            const fontMethod = `${Math.round(baseSize * 1.10)}px ${fontFamily}`;
            const fontButton = `bold ${Math.round(baseSize * 0.72)}px ${fontFamily}`;

            const meaningLines = wrapText(chineseMeaning, fontMeaning, wrapWidth);
            const methodLines = wrapText(memoryMethod, fontMethod, wrapWidth);

            let currentY = paddingY + baseSize * 1.8 + meaningLines.length * (baseSize * 1.5) + baseSize * 2.3 + methodLines.length * (baseSize * 1.3) + paddingY;
            const canvasHeight = Math.round(currentY);
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            // 保持背景透明，依靠 3D backplate 提供暗色玻璃质感
            context.clearRect(0, 0, canvasWidth, canvasHeight);
            context.shadowColor = textGlowColor;
            context.shadowBlur = textGlowIntensity * 20 * scale;
            context.textBaseline = 'top';

            // 1. 主单词 (如 tall)
            context.textAlign = "left";
            context.font = fontMain;
            context.fillStyle = mainWordColor;
            context.fillText(englishWord, paddingX, paddingY);

            testCtx.font = fontMain;
            const wordWidth = testCtx.measureText(englishWord).width;

            // 2. 音标 (如 /tɔ:l/)
            context.font = fontPhonetic;
            context.fillStyle = labelColor;
            context.fillText(phoneticSymbol, paddingX + wordWidth + 25 * scale, paddingY + (baseSize * 0.35));

            // 3. 右上角精致胶囊按钮 (A-, A+, 屏蔽)
            const btnHeight = baseSize * 0.9;
            const spacing = 10 * scale;
            const btnY = paddingY + (baseSize * 1.55 - btnHeight) / 2;
            const btnWidthA = baseSize * 1.1;
            const btnWidthShield = baseSize * 1.6;

            const btnShieldX = canvasWidth - paddingX - btnWidthShield;
            const btnPlusX = btnShieldX - spacing - btnWidthA;
            const btnMinusX = btnPlusX - spacing - btnWidthA;

            word.hover_click_zones = [];

            function drawPillButton(label, x, y, w, h) {
                context.save();
                context.fillStyle = "rgba(0, 240, 255, 0.08)";
                context.strokeStyle = "rgba(0, 240, 255, 0.38)";
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
                context.fillStyle = "rgba(162, 216, 255, 0.92)";
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.fillText(label, x + w / 2, y + h / 2);
                context.restore();
            }

            drawPillButton("A-", btnMinusX, btnY, btnWidthA, btnHeight);
            word.hover_click_zones.push({
                type: 'fontSizeDown',
                xMin: btnMinusX, xMax: btnMinusX + btnWidthA,
                yMin: btnY, yMax: btnY + btnHeight
            });

            drawPillButton("A+", btnPlusX, btnY, btnWidthA, btnHeight);
            word.hover_click_zones.push({
                type: 'fontSizeUp',
                xMin: btnPlusX, xMax: btnPlusX + btnWidthA,
                yMin: btnY, yMax: btnY + btnHeight
            });

            drawPillButton("屏蔽", btnShieldX, btnY, btnWidthShield, btnHeight);
            word.hover_click_zones.push({
                type: 'shield',
                xMin: btnShieldX, xMax: btnShieldX + btnWidthShield,
                yMin: btnY, yMax: btnY + btnHeight
            });

            word.hover_click_zones.push({
                type: 'word',
                xMin: paddingX, xMax: btnMinusX - spacing,
                yMin: paddingY - 5 * scale, yMax: paddingY + baseSize * 1.6
            });

            // 4. 释义 (如 高的)
            let writeY = paddingY + baseSize * 1.8;
            context.font = fontMeaning;
            context.fillStyle = valueColor;
            meaningLines.forEach(line => {
                context.fillText(line, paddingX, writeY);
                writeY += baseSize * 1.5;
            });

            // 5. 分割线
            writeY += baseSize * 0.4;
            context.strokeStyle = "rgba(104, 240, 255, 0.25)";
            context.lineWidth = Math.max(1, Math.round(1 * scale));
            context.beginPath();
            context.moveTo(paddingX, writeY);
            context.lineTo(canvasWidth - paddingX, writeY);
            context.stroke();

            // 6. 记忆法标题 (黄色醒目)
            writeY += baseSize * 0.6;
            context.font = fontTitle;
            context.fillStyle = "#FFD700";
            context.fillText("💡 记忆方法 / Memory Association", paddingX, writeY);

            // 7. 记忆法内容
            writeY += baseSize * 1.3;
            context.font = fontMethod;
            context.fillStyle = "rgba(255, 255, 192, 0.95)";
            methodLines.forEach(line => {
                context.fillText(line, paddingX, writeY);
                writeY += baseSize * 1.3;
            });

            return {
                texture: finalizeCanvasTexture(canvas, 4),
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